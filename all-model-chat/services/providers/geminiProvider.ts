import { AIProvider, ProviderConfig, ModelOption, ChatHistoryItem } from '../../types';
import { Part } from "@google/genai";
import { PROVIDER_IDS } from '../../constants/providerConstants';
import { geminiServiceInstance } from '../geminiService';
import { logService } from '../logService';

class GeminiProvider implements AIProvider {
  id = PROVIDER_IDS.GEMINI;
  name = 'Google Gemini';
  supportsImages = true;
  supportsStreaming = true;
  supportsSystemMessages = true;
  supportsFileUpload = true;

  async getAvailableModels(config: ProviderConfig): Promise<ModelOption[]> {
    try {
      logService.info('Fetching Gemini models via existing service');
      
      const models = await geminiServiceInstance.getAvailableModels(config.apiKey);
      
      // Convert existing models to new format with provider info
      return models.map(model => ({
        ...model,
        providerId: this.id,
        providerName: this.name,
        displayName: model.name,
        supportsImages: true,
        supportsStreaming: true,
        supportsSystemMessages: true,
      }));
    } catch (error) {
      logService.error('Failed to fetch Gemini models:', error);
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
    try {
      logService.info(`Sending streaming request to Gemini model: ${modelId}`);
      
      if (!config.apiKey) {
        throw new Error('Gemini API key not configured');
      }

      await geminiServiceInstance.sendMessageStream(
        config.apiKey,
        modelId,
        historyWithLastPrompt,
        systemInstruction,
        generationConfig,
        true, // showThoughts - we can make this configurable later
        -1, // thinkingBudget
        false, // isGoogleSearchEnabled - these should come from settings
        false, // isCodeExecutionEnabled 
        false, // isUrlContextEnabled
        abortSignal,
        onPart,
        () => {}, // onThoughtChunk - empty for now
        onError,
        onComplete
      );
    } catch (error) {
      logService.error('Gemini streaming error:', error);
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
    try {
      logService.info(`Sending non-streaming request to Gemini model: ${modelId}`);
      
      if (!config.apiKey) {
        throw new Error('Gemini API key not configured');
      }

      await geminiServiceInstance.sendMessageNonStream(
        config.apiKey,
        modelId,
        historyWithLastPrompt,
        systemInstruction,
        generationConfig,
        true, // showThoughts
        -1, // thinkingBudget
        false, // isGoogleSearchEnabled
        false, // isCodeExecutionEnabled
        false, // isUrlContextEnabled
        abortSignal,
        onError,
        (parts, thoughtsText, usageMetadata, groundingMetadata) => {
          onComplete(parts, usageMetadata);
        }
      );
    } catch (error) {
      logService.error('Gemini non-streaming error:', error);
      onError(error as Error);
    }
  }
}

export const geminiProvider = new GeminiProvider();