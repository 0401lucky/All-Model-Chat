import { AIProvider, ProviderRegistry, ProviderConfig, ModelOption } from '../types';
import { PROVIDER_IDS, DEFAULT_PROVIDERS, FALLBACK_MODELS } from '../constants/providerConstants';
import { logService } from './logService';

// Import all providers
import { geminiProvider } from './providers/geminiProvider';
import { openaiProvider } from './providers/openaiProvider';
import { anthropicProvider } from './providers/anthropicProvider';
import { customProvider } from './providers/customProvider';

class ProviderRegistryImpl implements ProviderRegistry {
  public providers: Map<string, AIProvider> = new Map();
  
  constructor() {
    logService.info('ProviderRegistry initialized');
    
    // Register all providers
    this.registerProvider(geminiProvider);
    this.registerProvider(openaiProvider);
    this.registerProvider(anthropicProvider);
    // Note: customProvider will be registered dynamically for custom configs
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    logService.info(`Provider registered: ${provider.name} (${provider.id})`);
  }

  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  // Register custom provider instances for user-defined providers
  registerCustomProvider(config: ProviderConfig): void {
    if (config.id !== PROVIDER_IDS.CUSTOM && !this.providers.has(config.id)) {
      // Create a new custom provider instance for this specific config
      const customProviderInstance = Object.create(customProvider);
      customProviderInstance.id = config.id;
      customProviderInstance.name = config.name;
      
      this.registerProvider(customProviderInstance);
    }
  }

  async getAllAvailableModels(providerConfigs: ProviderConfig[]): Promise<ModelOption[]> {
    const allModels: ModelOption[] = [];
    
    // Register custom providers first
    for (const config of providerConfigs) {
      if (!this.providers.has(config.id)) {
        this.registerCustomProvider(config);
      }
    }
    
    for (const config of providerConfigs) {
      if (!config.enabled) continue;
      
      const provider = this.getProvider(config.id);
      if (!provider) {
        logService.warn(`Provider not found: ${config.id}`);
        // Use fallback models if available
        const fallbackModels = FALLBACK_MODELS[config.id as keyof typeof FALLBACK_MODELS];
        if (fallbackModels) {
          allModels.push(...fallbackModels);
        }
        continue;
      }

      try {
        logService.info(`Fetching models for provider: ${provider.name}`);
        const models = await provider.getAvailableModels(config);
        allModels.push(...models);
        logService.info(`Fetched ${models.length} models from ${provider.name}`);
      } catch (error) {
        logService.error(`Failed to fetch models from ${provider.name}:`, error);
        
        // Use fallback models on error
        const fallbackModels = FALLBACK_MODELS[config.id as keyof typeof FALLBACK_MODELS];
        if (fallbackModels) {
          logService.info(`Using fallback models for ${provider.name}`);
          allModels.push(...fallbackModels);
        }
      }
    }

    return allModels.sort((a, b) => {
      // Sort by provider name first, then by model name
      const providerComparison = a.providerName.localeCompare(b.providerName);
      if (providerComparison !== 0) return providerComparison;
      return a.name.localeCompare(b.name);
    });
  }

  getProviderForModel(modelId: string, providerConfigs: ProviderConfig[]): { provider: AIProvider, config: ProviderConfig } | null {
    // First try to find based on model ID patterns
    for (const config of providerConfigs) {
      if (!config.enabled) continue;
      
      const provider = this.getProvider(config.id);
      if (!provider) continue;

      // Check if model ID matches provider pattern
      if (this.isModelFromProvider(modelId, config.id)) {
        return { provider, config };
      }
    }

    // Fallback: search through all enabled providers
    for (const config of providerConfigs) {
      if (!config.enabled) continue;
      
      const provider = this.getProvider(config.id);
      if (provider) {
        return { provider, config };
      }
    }

    return null;
  }

  private isModelFromProvider(modelId: string, providerId: string): boolean {
    // Model ID patterns to identify provider
    const patterns = {
      [PROVIDER_IDS.GEMINI]: /^gemini|^models\/gemini/,
      [PROVIDER_IDS.OPENAI]: /^gpt-|^text-|^davinci|^curie|^babbage|^ada/,
      [PROVIDER_IDS.ANTHROPIC]: /^claude/,
    };

    const pattern = patterns[providerId as keyof typeof patterns];
    return pattern ? pattern.test(modelId) : false;
  }

  getDefaultProviderConfigs(): ProviderConfig[] {
    return [...DEFAULT_PROVIDERS];
  }
}

export const providerRegistry = new ProviderRegistryImpl();