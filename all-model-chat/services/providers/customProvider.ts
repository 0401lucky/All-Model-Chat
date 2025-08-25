import { AIProvider, ProviderConfig, ModelOption, ChatHistoryItem } from '../types';
import { Part } from "@google/genai";
import { PROVIDER_IDS } from '../constants/providerConstants';
import { logService } from './logService';

interface CustomMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

interface CustomResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
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
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

class CustomProvider implements AIProvider {
  id = PROVIDER_IDS.CUSTOM;
  name = 'Custom Provider';
  supportsImages = true;
  supportsStreaming = true;
  supportsSystemMessages = true;
  supportsFileUpload = false;

  async getAvailableModels(config: ProviderConfig): Promise<ModelOption[]> {
    if (!config.apiKey) {
      throw new Error('Custom provider API key not configured');
    }

    try {
      logService.info(`Fetching models from custom provider: ${config.name}`);
      
      // Try to fetch models from /models endpoint (OpenAI-compatible)
      const modelsUrl = config.baseUrl?.endsWith('/') 
        ? `${config.baseUrl}models` 
        : `${config.baseUrl}/models`;

      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...config.customHeaders,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Handle different response formats
        let models: any[] = [];
        
        if (data.data && Array.isArray(data.data)) {
          // OpenAI-style response
          models = data.data;
        } else if (Array.isArray(data)) {
          // Direct array response
          models = data;
        } else if (data.models && Array.isArray(data.models)) {
          // Gemini-style response
          models = data.models;
        }

        const modelOptions: ModelOption[] = models.map((model: any) => ({
          id: model.id || model.name || model.model,
          name: this.formatModelName(model.displayName || model.id || model.name || model.model),
          providerId: config.id,
          providerName: config.name,
          displayName: model.displayName || model.id || model.name || model.model,
          supportsImages: true, // Assume support unless specified otherwise
          supportsStreaming: true,
          supportsSystemMessages: true,
          maxTokens: model.max_tokens || 4096,
        }));

        return modelOptions.sort((a, b) => a.name.localeCompare(b.name));
      }

      // If models endpoint fails, return a default model
      logService.warn(`Failed to fetch models from custom provider ${config.name}, using default model`);
      return [
        {
          id: 'default',
          name: 'Default Model',
          providerId: config.id,
          providerName: config.name,
          displayName: 'Default Model',
          supportsImages: true,
          supportsStreaming: true,
          supportsSystemMessages: true,
          maxTokens: 4096,
        }
      ];
    } catch (error) {
      logService.error(`Failed to fetch models from custom provider ${config.name}:`, error);
      
      // Return a default model on error
      return [
        {
          id: 'default',
          name: 'Default Model',
          providerId: config.id,
          providerName: config.name,
          displayName: 'Default Model',
          supportsImages: true,
          supportsStreaming: true,
          supportsSystemMessages: true,
          maxTokens: 4096,
        }
      ];
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
      throw new Error('Custom provider API key not configured');
    }

    try {
      const messages = this.convertHistoryToOpenAIFormat(historyWithLastPrompt, systemInstruction);
      
      const chatUrl = config.baseUrl?.endsWith('/') 
        ? `${config.baseUrl}chat/completions` 
        : `${config.baseUrl}/chat/completions`;

      const requestBody = {
        model: modelId,
        messages,
        stream: true,
        temperature: generationConfig.temperature || 0.7,
        top_p: generationConfig.topP || 1.0,
      };

      logService.info(`Sending streaming request to custom provider ${config.name} model: ${modelId}`);

      const response = await fetch(chatUrl, {
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
        throw new Error(`Custom provider API error: ${response.status} ${response.statusText} - ${errorData}`);
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
                const parsed: CustomResponse = JSON.parse(data);
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
                logService.warn('Failed to parse custom provider stream chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      onComplete(usageMetadata);
    } catch (error) {
      logService.error(`Custom provider ${config.name} streaming error:`, error);
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
      throw new Error('Custom provider API key not configured');
    }

    try {
      const messages = this.convertHistoryToOpenAIFormat(historyWithLastPrompt, systemInstruction);
      
      const chatUrl = config.baseUrl?.endsWith('/') 
        ? `${config.baseUrl}chat/completions` 
        : `${config.baseUrl}/chat/completions`;

      const requestBody = {
        model: modelId,
        messages,
        stream: false,
        temperature: generationConfig.temperature || 0.7,
        top_p: generationConfig.topP || 1.0,
      };

      logService.info(`Sending non-streaming request to custom provider ${config.name} model: ${modelId}`);

      const response = await fetch(chatUrl, {
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
        throw new Error(`Custom provider API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data: CustomResponse = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice?.message?.content) {
        throw new Error('No content in custom provider response');
      }

      const parts: Part[] = [{ text: choice.message.content }];
      const usageMetadata = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined;

      onComplete(parts, usageMetadata);
    } catch (error) {
      logService.error(`Custom provider ${config.name} non-streaming error:`, error);
      onError(error as Error);
    }
  }

  private convertHistoryToOpenAIFormat(history: ChatHistoryItem[], systemInstruction: string): CustomMessage[] {
    const messages: CustomMessage[] = [];

    // Add system message if provided
    if (systemInstruction.trim()) {
      messages.push({
        role: 'system',
        content: systemInstruction,
      });
    }

    // Convert history to OpenAI-compatible format
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
    // Basic formatting for custom model names
    return modelId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export const customProvider = new CustomProvider();