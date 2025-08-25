import { AIProvider, ProviderConfig, ModelOption, ChatHistoryItem } from '../types';
import { Part } from "@google/genai";
import { PROVIDER_IDS } from '../constants/providerConstants';
import { logService } from './logService';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamResponse {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: Partial<AnthropicResponse>;
  content_block?: {
    type: 'text';
    text: string;
  };
  delta?: {
    type: 'text_delta';
    text: string;
  };
  usage?: {
    output_tokens: number;
  };
}

class AnthropicProvider implements AIProvider {
  id = PROVIDER_IDS.ANTHROPIC;
  name = 'Anthropic Claude';
  supportsImages = true;
  supportsStreaming = true;
  supportsSystemMessages = true;
  supportsFileUpload = false;

  async getAvailableModels(config: ProviderConfig): Promise<ModelOption[]> {
    // Anthropic doesn't have a public models endpoint, so we return a predefined list
    logService.info('Using predefined Anthropic models list');
    
    const predefinedModels = [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        maxTokens: 200000,
        supportsImages: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        maxTokens: 200000,
        supportsImages: true,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        maxTokens: 200000,
        supportsImages: true,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        maxTokens: 200000,
        supportsImages: true,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        maxTokens: 200000,
        supportsImages: true,
      },
    ];

    return predefinedModels.map(model => ({
      id: model.id,
      name: model.name,
      providerId: this.id,
      providerName: this.name,
      displayName: model.name,
      supportsImages: model.supportsImages,
      supportsStreaming: true,
      supportsSystemMessages: true,
      maxTokens: model.maxTokens,
    }));
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
      throw new Error('Anthropic API key not configured');
    }

    try {
      const messages = this.convertHistoryToAnthropic(historyWithLastPrompt);
      
      const requestBody: any = {
        model: modelId,
        max_tokens: 4096,
        messages,
        stream: true,
        temperature: generationConfig.temperature || 0.7,
        top_p: generationConfig.topP || 1.0,
      };

      if (systemInstruction.trim()) {
        requestBody.system = systemInstruction;
      }

      logService.info(`Sending streaming request to Anthropic model: ${modelId}`);

      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...config.customHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorData}`);
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
              
              try {
                const parsed: AnthropicStreamResponse = JSON.parse(data);
                
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  onPart({ text: parsed.delta.text });
                } else if (parsed.type === 'message_start' && parsed.message?.usage) {
                  usageMetadata = {
                    promptTokens: parsed.message.usage.input_tokens,
                    completionTokens: 0,
                    totalTokens: parsed.message.usage.input_tokens,
                  };
                } else if (parsed.type === 'message_delta' && parsed.usage) {
                  if (usageMetadata) {
                    usageMetadata.completionTokens = parsed.usage.output_tokens;
                    usageMetadata.totalTokens = usageMetadata.promptTokens + parsed.usage.output_tokens;
                  }
                }
              } catch (parseError) {
                logService.warn('Failed to parse Anthropic stream chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      onComplete(usageMetadata);
    } catch (error) {
      logService.error('Anthropic streaming error:', error);
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
      throw new Error('Anthropic API key not configured');
    }

    try {
      const messages = this.convertHistoryToAnthropic(historyWithLastPrompt);
      
      const requestBody: any = {
        model: modelId,
        max_tokens: 4096,
        messages,
        temperature: generationConfig.temperature || 0.7,
        top_p: generationConfig.topP || 1.0,
      };

      if (systemInstruction.trim()) {
        requestBody.system = systemInstruction;
      }

      logService.info(`Sending non-streaming request to Anthropic model: ${modelId}`);

      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...config.customHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data: AnthropicResponse = await response.json();
      
      if (!data.content || data.content.length === 0) {
        throw new Error('No content in Anthropic response');
      }

      const parts: Part[] = data.content.map(block => ({ text: block.text }));
      const usageMetadata = data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined;

      onComplete(parts, usageMetadata);
    } catch (error) {
      logService.error('Anthropic non-streaming error:', error);
      onError(error as Error);
    }
  }

  private convertHistoryToAnthropic(history: ChatHistoryItem[]): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];
    
    for (const item of history) {
      const role = item.role === 'model' ? 'assistant' : 'user';
      
      // Handle text and images
      const contentParts: Array<{ type: 'text' | 'image'; text?: string; source?: any }> = [];
      
      for (const part of item.parts) {
        if (part.text) {
          contentParts.push({
            type: 'text',
            text: part.text,
          });
        } else if (part.inlineData) {
          // Convert inline data to Anthropic format
          contentParts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
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
}

export const anthropicProvider = new AnthropicProvider();