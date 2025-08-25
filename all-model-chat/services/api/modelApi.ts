import { getClient } from './baseApi';
import { ModelOption } from '../../types';
import { logService } from "../logService";
import { proxyService } from '../proxyService';
import { unifiedModelService } from '../unifiedModelService';

export const getAvailableModelsApi = async (apiKeysString: string | null): Promise<ModelOption[]> => {
    logService.info('🔄 [ModelAPI] Fetching available models via unified service...');
    
    try {
        // Try to get app settings to determine if we should use new provider system
        const storedSettings = localStorage.getItem('app-settings');
        const settings = storedSettings ? JSON.parse(storedSettings) : {};
        
        // If provider configs exist in settings, use the new unified system
        if (settings.providerConfigs && Array.isArray(settings.providerConfigs)) {
            logService.info('🔄 Using new multi-provider system');
            return await unifiedModelService.getAvailableModels(settings);
        }
        
        // Check if we should try the unified system with default providers
        if (settings.useMultipleProviders !== false) {
            try {
                logService.info('🔄 Attempting unified model fetch with default providers');
                // Pass current settings to unified service
                const unifiedSettings = {
                    ...settings,
                    apiKey: apiKeysString
                };
                return await unifiedModelService.getAvailableModels(unifiedSettings);
            } catch (error) {
                logService.warn('Unified model fetch failed, falling back to legacy Gemini-only mode:', error);
            }
        }
        
        // Fallback to original Gemini-only implementation for backward compatibility
        logService.info('🔄 Using legacy Gemini-only model fetching');
        return await getLegacyGeminiModels(apiKeysString, settings);
        
    } catch (error) {
        logService.error("Failed to fetch available models:", error);
        throw error;
    }
};

// Legacy Gemini-only model fetching (original implementation)
async function getLegacyGeminiModels(apiKeysString: string | null, settings: any): Promise<ModelOption[]> {
    const keys = (apiKeysString || '').split('\n').map(k => k.trim()).filter(Boolean);

    if (keys.length === 0) {
        logService.warn('getAvailableModels called with no API keys.');
        throw new Error("API client not initialized. Configure API Key in settings.");
    }
    
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    logService.info(`🔑 [ModelAPI] Using API key: ${randomKey.substring(0, 10)}...`);
    
    const useCustomApiConfig = settings.useCustomApiConfig;
    const apiProxyUrl = settings.apiProxyUrl;
    
    logService.info('⚙️ [ModelAPI] Settings check:', {
        useCustomApiConfig,
        apiProxyUrl,
        hasSettings: !!settings,
        settingsKeys: Object.keys(settings)
    });
    
    // 如果启用了自定义配置且有代理 URL，强制使用代理服务
    if (useCustomApiConfig && apiProxyUrl) {
        try {
            logService.info('🔄 Attempting to fetch models via proxy service...');
            const response = await proxyService.getModels(randomKey);
            
            if (response && response.models) {
                const availableModels: ModelOption[] = [];
                
                for (const model of response.models) {
                    const supported = model.supportedActions;
                    if (!supported || supported.includes('generateContent') || supported.includes('generateImages')) {
                        availableModels.push({
                            id: model.name,
                            name: model.displayName || model.name.split('/').pop() || model.name,
                            providerId: 'gemini',
                            providerName: 'Google Gemini',
                            isPinned: false,
                        });
                    }
                }

                if (availableModels.length > 0) {
                    logService.info(`✅ Fetched ${availableModels.length} models successfully via proxy.`);
                    return availableModels.sort((a,b) => a.name.localeCompare(b.name));
                } else {
                    logService.warn('Proxy returned empty model list');
                }
            } else {
                logService.warn('Proxy returned invalid response format');
            }
        } catch (proxyError) {
            logService.error('❌ Proxy service failed:', proxyError);
            // 如果启用了代理但失败了，不要回退，直接抛出错误
            throw new Error(`Proxy service failed: ${proxyError.message}`);
        }
    } else {
        logService.info('Custom API config not enabled or no proxy URL, using direct API');
    }

    // 回退到原始的 GoogleGenAI SDK 方法
    try {
        // Get proxy URL from localStorage if available
        const ai = getClient(randomKey, apiProxyUrl);

        const modelPager = await ai.models.list();
        const availableModels: ModelOption[] = [];
        for await (const model of modelPager) {
            const supported = model.supportedActions;
            if (!supported || supported.includes('generateContent') || supported.includes('generateImages')) {
                availableModels.push({
                    id: model.name,
                    name: model.displayName || model.name.split('/').pop() || model.name,
                    providerId: 'gemini',
                    providerName: 'Google Gemini',
                    isPinned: false,
                });
            }
        }

        if (availableModels.length > 0) {
            logService.info(`Fetched ${availableModels.length} models successfully via SDK fallback.`);
            return availableModels.sort((a,b) => a.name.localeCompare(b.name));
        } else {
            // If the API returns an empty list, treat it as an error so fallbacks are used.
            logService.warn("API returned an empty list of models.");
            throw new Error("API returned an empty list of models.");
        }
    } catch (error) {
        logService.error("Failed to fetch available models from Gemini API:", error);
        // Re-throw the error for the caller to handle and provide fallbacks.
        throw error;
    }
}
