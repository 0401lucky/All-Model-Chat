import { ModelOption, ProviderConfig } from '../types';
import { providerRegistry } from './providerRegistry';
import { DEFAULT_PROVIDERS, PROVIDER_IDS } from '../constants/providerConstants';
import { logService } from './logService';

class UnifiedModelService {
  
  async getAvailableModels(appSettings: any): Promise<ModelOption[]> {
    try {
      logService.info('Fetching models from all configured providers...');
      
      // Get provider configurations from app settings
      const providerConfigs = this.getProviderConfigs(appSettings);
      
      // Fetch models from all providers
      const models = await providerRegistry.getAllAvailableModels(providerConfigs);
      
      logService.info(`Fetched total of ${models.length} models from all providers`);
      return models;
      
    } catch (error) {
      logService.error('Failed to fetch unified model list:', error);
      throw error;
    }
  }

  private getProviderConfigs(appSettings: any): ProviderConfig[] {
    // Start with default provider configs
    let providerConfigs = [...DEFAULT_PROVIDERS];

    // If user has custom provider configs in settings, use those instead
    if (appSettings?.providerConfigs && Array.isArray(appSettings.providerConfigs)) {
      providerConfigs = appSettings.providerConfigs;
    } else {
      // Set up default configs with user's API keys
      providerConfigs = providerConfigs.map(config => {
        const updatedConfig = { ...config };
        
        if (config.id === PROVIDER_IDS.GEMINI && appSettings?.apiKey) {
          updatedConfig.apiKey = appSettings.apiKey;
          updatedConfig.enabled = true;
          
          // Use custom proxy URL if configured
          if (appSettings?.useCustomApiConfig && appSettings?.apiProxyUrl) {
            updatedConfig.baseUrl = appSettings.apiProxyUrl;
          }
        }
        
        return updatedConfig;
      });
    }

    return providerConfigs;
  }

  getProviderForModel(modelId: string, appSettings: any): { provider: any, config: ProviderConfig } | null {
    const providerConfigs = this.getProviderConfigs(appSettings);
    return providerRegistry.getProviderForModel(modelId, providerConfigs);
  }

  // Compatibility method for existing code that expects the old API
  async getAvailableModelsLegacy(apiKeyString: string | null): Promise<ModelOption[]> {
    try {
      logService.info('Legacy model fetch - converting to new provider system');
      
      // Create a simple config for Gemini provider only (for backwards compatibility)
      const geminiConfig: ProviderConfig = {
        id: PROVIDER_IDS.GEMINI,
        name: 'Google Gemini',
        apiKey: apiKeyString || undefined,
        enabled: true,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
      };

      const models = await providerRegistry.getAllAvailableModels([geminiConfig]);
      return models;
      
    } catch (error) {
      logService.error('Legacy model fetch failed:', error);
      throw error;
    }
  }
}

export const unifiedModelService = new UnifiedModelService();