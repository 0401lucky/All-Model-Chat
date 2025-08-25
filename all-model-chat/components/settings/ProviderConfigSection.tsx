import React, { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { ProviderConfig } from '../../types';
import { DEFAULT_PROVIDERS, PROVIDER_IDS } from '../../constants/providerConstants';
import { getResponsiveValue } from '../../utils/appUtils';

interface ProviderConfigSectionProps {
  providerConfigs: ProviderConfig[];
  onProviderConfigsChange: (configs: ProviderConfig[]) => void;
  t: (key: string) => string;
}

export const ProviderConfigSection: React.FC<ProviderConfigSectionProps> = ({
  providerConfigs,
  onProviderConfigsChange,
  t,
}) => {
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const iconSize = getResponsiveValue(14, 16);

  const toggleApiKeyVisibility = (providerId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const toggleProviderExpansion = (providerId: string) => {
    setExpandedProviders(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const updateProvider = (providerId: string, updates: Partial<ProviderConfig>) => {
    const updatedConfigs = providerConfigs.map(config =>
      config.id === providerId ? { ...config, ...updates } : config
    );
    onProviderConfigsChange(updatedConfigs);
  };

  const addCustomProvider = () => {
    const newProvider: ProviderConfig = {
      id: `custom-${Date.now()}`,
      name: 'Custom Provider',
      enabled: false,
      baseUrl: 'https://api.example.com/v1',
      customHeaders: {}
    };
    
    onProviderConfigsChange([...providerConfigs, newProvider]);
    setExpandedProviders(prev => ({ ...prev, [newProvider.id]: true }));
  };

  const removeProvider = (providerId: string) => {
    // Only allow removal of custom providers
    if (!providerId.startsWith('custom-')) return;
    
    const updatedConfigs = providerConfigs.filter(config => config.id !== providerId);
    onProviderConfigsChange(updatedConfigs);
  };

  const resetToDefaults = () => {
    const defaultConfigs = [...DEFAULT_PROVIDERS];
    onProviderConfigsChange(defaultConfigs);
    setExpandedProviders({});
    setShowApiKeys({});
  };

  const inputBaseClasses = "w-full p-2 border rounded-md focus:ring-2 focus:border-[var(--theme-border-focus)] text-[var(--theme-text-primary)] placeholder-[var(--theme-text-tertiary)] text-sm";
  const enabledInputClasses = "bg-[var(--theme-bg-input)] border-[var(--theme-border-secondary)] focus:ring-[var(--theme-border-focus)]";
  const disabledInputClasses = "bg-[var(--theme-bg-secondary)] border-[var(--theme-border-primary)] opacity-60 cursor-not-allowed";

  return (
    <div className="space-y-4 p-3 sm:p-4 rounded-lg bg-[var(--theme-bg-secondary)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--theme-text-primary)] flex items-center">
          <Settings size={iconSize} className="mr-2 text-[var(--theme-text-link)] opacity-80" />
          AI Provider Configuration
        </h3>
        <button
          onClick={resetToDefaults}
          className="text-xs px-2 py-1 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border-secondary)] rounded hover:bg-[var(--theme-bg-tertiary)]"
        >
          Reset to Defaults
        </button>
      </div>

      <div className="space-y-3">
        {providerConfigs.map((config) => {
          const isExpanded = expandedProviders[config.id];
          const showKey = showApiKeys[config.id];
          const isCustomProvider = config.id.startsWith('custom-');

          return (
            <div 
              key={config.id} 
              className="border border-[var(--theme-border-secondary)] rounded-lg bg-[var(--theme-bg-primary)] overflow-hidden"
            >
              {/* Provider Header */}
              <div 
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-[var(--theme-bg-tertiary)]"
                onClick={() => toggleProviderExpansion(config.id)}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateProvider(config.id, { enabled: !config.enabled });
                    }}
                    className="flex items-center"
                  >
                    {config.enabled ? (
                      <ToggleRight className="text-[var(--theme-bg-accent)]" size={20} />
                    ) : (
                      <ToggleLeft className="text-[var(--theme-text-tertiary)]" size={20} />
                    )}
                  </button>
                  <div>
                    <h4 className={`font-medium ${config.enabled ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-tertiary)]'}`}>
                      {config.name}
                    </h4>
                    <p className="text-xs text-[var(--theme-text-tertiary)]">
                      {config.enabled ? 'Enabled' : 'Disabled'} • {config.baseUrl || 'No URL'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isCustomProvider && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProvider(config.id);
                      }}
                      className="p-1 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-error)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Provider Details */}
              {isExpanded && (
                <div className="p-3 border-t border-[var(--theme-border-secondary)] space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--theme-text-secondary)] mb-1.5">
                      Provider Name
                    </label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => updateProvider(config.id, { name: e.target.value })}
                      className={`${inputBaseClasses} ${config.enabled ? enabledInputClasses : disabledInputClasses}`}
                      disabled={!config.enabled}
                      placeholder="Provider Name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--theme-text-secondary)] mb-1.5">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={config.apiKey || ''}
                        onChange={(e) => updateProvider(config.id, { apiKey: e.target.value || undefined })}
                        className={`${inputBaseClasses} ${config.enabled ? enabledInputClasses : disabledInputClasses} pr-10`}
                        disabled={!config.enabled}
                        placeholder="Enter API key..."
                      />
                      <button
                        type="button"
                        onClick={() => toggleApiKeyVisibility(config.id)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)]"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--theme-text-secondary)] mb-1.5">
                      Base URL
                    </label>
                    <input
                      type="url"
                      value={config.baseUrl || ''}
                      onChange={(e) => updateProvider(config.id, { baseUrl: e.target.value || undefined })}
                      className={`${inputBaseClasses} ${config.enabled ? enabledInputClasses : disabledInputClasses}`}
                      disabled={!config.enabled}
                      placeholder="https://api.provider.com/v1"
                    />
                  </div>

                  {isCustomProvider && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--theme-text-secondary)] mb-1.5">
                        Custom Headers (JSON)
                      </label>
                      <textarea
                        rows={3}
                        value={JSON.stringify(config.customHeaders || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const headers = JSON.parse(e.target.value);
                            updateProvider(config.id, { customHeaders: headers });
                          } catch (error) {
                            // Invalid JSON, don't update
                          }
                        }}
                        className={`${inputBaseClasses} ${config.enabled ? enabledInputClasses : disabledInputClasses} font-mono text-xs`}
                        disabled={!config.enabled}
                        placeholder='{"Authorization": "Bearer token", "Custom-Header": "value"}'
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addCustomProvider}
        className="w-full p-3 border-2 border-dashed border-[var(--theme-border-secondary)] rounded-lg text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-border-focus)] transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Add Custom Provider
      </button>

      <div className="text-xs text-[var(--theme-text-tertiary)] p-3 bg-[var(--theme-bg-info)] bg-opacity-20 rounded-md border border-[var(--theme-border-secondary)]">
        <p className="mb-1"><strong>Note:</strong> Configure your AI providers to access different models in the chat interface.</p>
        <p>• <strong>Google Gemini:</strong> Get your API key from Google AI Studio</p>
        <p>• <strong>OpenAI:</strong> Get your API key from OpenAI Platform</p>
        <p>• <strong>Anthropic:</strong> Get your API key from Anthropic Console</p>
        <p>• <strong>Custom:</strong> For OpenAI-compatible APIs from other providers</p>
      </div>
    </div>
  );
};