import { AIProvider, ProviderConfig, ModelOption, ChatHistoryItem } from '../types';
import { Part } from "@google/genai";
import { PROVIDER_IDS } from '../constants/providerConstants';
import { logService } from './logService';

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenAIProvider implements AIProvider {
  id = PROVIDER_IDS.OPENAI;
  name = 'OpenAI';
  supportsImages = true;
  supportsStreaming = true;
  supportsSystemMessages = true;
  supportsFileUpload = false;

  async getAvailableModels(config: ProviderConfig): Promise<ModelOption[]> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      logService.info('Fetching OpenAI models...');
      
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...config.customHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models: ModelOption[] = data.data
        .filter((model: any) => model.id.includes('gpt') || model.id.includes('text'))
        .map((model: any) => ({
          id: model.id,
          name: this.formatModelName(model.id),
          providerId: this.id,
          providerName: this.name,
          displayName: this.formatModelName(model.id),
          supportsImages: model.id.includes('gpt-4') && !model.id.includes('gpt-4-32k'),
          supportsStreaming: true,
          supportsSystemMessages: true,
          maxTokens: this.getMaxTokens(model.id),
        }));

      return models.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logService.error('Failed to fetch OpenAI models:', error);
      throw error;
    }
  }

  async sendMessageStream(
    config: ProviderConfig,
    modelId: string,
    historyWithLastPrompt: ChatHistoryItem[],
    systemInstruction: string,
    generationConfig: { temperature?: number; topP?: number },
    abortSignal: AbortSignal,
    onPart: (part: Part) => void,
    onError: (error: Error) => void,
    onComplete: (usageMetadata?: any) => void
  ): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const messages = this.convertHistoryToOpenAI(historyWithLastPrompt, systemInstruction);
      
      const requestBody = {
        model: modelId,
        messages,
        stream: true,
        temperature: generationConfig.temperature || 0.7,
        top_p: generationConfig.topP || 1.0,
      };

      logService.info(`Sending streaming request to OpenAI model: ${modelId}`);

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...config.customHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let usageMetadata: any = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed: OpenAIResponse = JSON.parse(data);
                const choice = parsed.choices?.[0];
                
                if (choice?.delta?.content) {
                  onPart({ text: choice.delta.content });
                }

                if (parsed.usage) {
                  usageMetadata = {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens,
                  };
                }
              } catch (parseError) {
                logService.warn('Failed to parse OpenAI stream chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      onComplete(usageMetadata);
    } catch (error) {
      logService.error('OpenAI streaming error:', error);
      onError(error as Error);
    }
  }

  async sendMessageNonStream(
    config: ProviderConfig,
    modelId: string,
    historyWithLastPrompt: ChatHistoryItem[],
    systemInstruction: string,
    generationConfig: { temperature?: number; topP?: number },
    abortSignal: AbortSignal,
    onError: (error: Error) => void,
    onComplete: (parts: Part[], usageMetadata?: any) => void
  ): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const messages = this.convertHistoryToOpenAI(historyWithLastPrompt, systemInstruction);
      
      const requestBody = {
        model: modelId,
        messages,
        stream: false,
        temperature: generationConfig.temperature || 0.7,
        top_p: generationConfig.topP || 1.0,
      };

      logService.info(`Sending non-streaming request to OpenAI model: ${modelId}`);

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...config.customHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data: OpenAIResponse = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice?.message?.content) {
        throw new Error('No content in OpenAI response');
      }

      const parts: Part[] = [{ text: choice.message.content }];
      const usageMetadata = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined;

      onComplete(parts, usageMetadata);
    } catch (error) {
      logService.error('OpenAI non-streaming error:', error);
      onError(error as Error);
    }
  }

  private convertHistoryToOpenAI(history: ChatHistoryItem[], systemInstruction: string): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    // Add system message if provided
    if (systemInstruction.trim()) {
      messages.push({
        role: 'system',
        content: systemInstruction,
      });
    }

    // Convert history to OpenAI format
    for (const item of history) {
      const role = item.role === 'model' ? 'assistant' : 'user';
      
      // Handle text and images
      const contentParts: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [];
      
      for (const part of item.parts) {
        if (part.text) {
          contentParts.push({
            type: 'text',
            text: part.text,
          });
        } else if (part.inlineData) {
          // Convert inline data to data URL
          const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          contentParts.push({
            type: 'image_url',
            image_url: { url: dataUrl },
          });
        }
      }

      messages.push({
        role,
        content: contentParts.length === 1 && contentParts[0].type === 'text' 
          ? contentParts[0].text!
          : contentParts,
      });
    }

    return messages;
  }

  private formatModelName(modelId: string): string {
    // Format model names for better display
    const nameMap: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    };

    return nameMap[modelId] || modelId;
  }

  private getMaxTokens(modelId: string): number {
    // Return approximate max tokens for different models
    const tokenLimits: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 4096,
    };

    return tokenLimits[modelId] || 4096;
  }
}

export const openaiProvider = new OpenAIProvider();