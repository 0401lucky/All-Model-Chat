import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { Settings, X, Monitor, Layers, MessageSquare, User, Info, DatabaseZap, KeyRound } from 'lucide-react';
import { DEFAULT_APP_SETTINGS } from '../constants/appConstants';
import { Theme } from '../constants/themeConstants';
import { translations, getResponsiveValue } from '../utils/appUtils';
import { ApiConfigSection } from './settings/ApiConfigSection';
import { AppearanceSection } from './settings/AppearanceSection';
import { ChatBehaviorSection } from './settings/ChatBehaviorSection';
import { DataManagementSection } from './settings/DataManagementSection';
import { SettingsActions } from './settings/SettingsActions';
import { AboutSection } from './settings/AboutSection';
import { ModelOption } from '../types';
import { Modal } from './shared/Modal';
import { FeatureFlags } from './settings/FeatureFlags';
import { Tooltip } from './settings/shared/Tooltip';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings; 
  availableModels: ModelOption[];
  availableThemes: Theme[]; 
  onSave: (newSettings: AppSettings) => void; 
  isModelsLoading: boolean;
  modelsLoadingError: string | null;
  onClearAllHistory: () => void;
  onClearCache: () => void;
  onOpenLogViewer: () => void;
  onInstallPwa: () => void;
  isInstallable: boolean;
  onImportSettings: (file: File) => void;
  onExportSettings: (includeHistory: boolean) => void;
  t: (key: keyof typeof translations) => string;
}

type SettingsTab = 'appearance' | 'model' | 'conversation' | 'account' | 'data' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, currentSettings, availableModels, availableThemes, 
  onSave, isModelsLoading, modelsLoadingError, onClearAllHistory, onClearCache, onOpenLogViewer,
  onInstallPwa, isInstallable, t, onImportSettings, onExportSettings
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  const tabIconSize = getResponsiveValue(18, 20);

  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      setActiveTab('appearance');
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleClose = () => { if (isOpen) onClose(); };
  const handleSave = () => { onSave(settings); };
  const handleResetToDefaults = () => { setSettings(DEFAULT_APP_SETTINGS); };
  
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs: { id: SettingsTab; labelKey: keyof typeof translations; icon: React.ReactNode }[] = [
    { id: 'appearance', labelKey: 'settingsTabAppearance', icon: <Monitor size={tabIconSize} /> },
    { id: 'model', labelKey: 'settingsTabModel', icon: <Layers size={tabIconSize} /> },
    { id: 'conversation', labelKey: 'settingsTabConversation', icon: <MessageSquare size={tabIconSize} /> },
    { id: 'account', labelKey: 'settingsTabAccount', icon: <KeyRound size={tabIconSize} /> },
    { id: 'data', labelKey: 'settingsTabData', icon: <DatabaseZap size={tabIconSize} /> },
    { id: 'about', labelKey: 'settingsTabAbout', icon: <Info size={tabIconSize} /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} noPadding contentClassName="w-full h-full sm:w-auto sm:h-auto">
      <div 
        className="bg-[var(--theme-bg-primary)] w-full h-full sm:rounded-2xl sm:shadow-premium sm:w-[50rem] sm:h-[38rem] flex flex-col"
        role="document"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-[var(--theme-border-primary)]">
          <h2 id="settings-title" className="text-lg font-semibold text-[var(--theme-text-primary)]">
            {t('settingsTitle')}
          </h2>
          <button ref={closeButtonRef} onClick={handleClose} className="text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]" aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow flex flex-row min-h-0">
          {/* Tab Navigation */}
          <nav className="flex-shrink-0 w-56 border-r border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] overflow-y-auto custom-scrollbar p-4 flex flex-col gap-1" aria-label="Tabs" role="tablist">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--theme-bg-primary)] focus:ring-[var(--theme-border-focus)]
                    ${activeTab === tab.id
                      ? 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] font-semibold'
                      : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)] hover:text-[var(--theme-text-primary)] font-medium'
                    }
                  `}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tab-panel-${tab.id}`}
                >
                  {tab.icon}
                  <span>{t(tab.labelKey)}</span>
                </button>
              ))}
          </nav>
          
          {/* Content Panel */}
          <div id={`tab-panel-${activeTab}`} role="tabpanel" className="flex-grow min-h-0 sm:min-w-0 overflow-y-auto custom-scrollbar bg-[var(--theme-bg-secondary)]">
            <div className="p-6 tab-content-enter-active">
              {activeTab === 'appearance' && (
                <div>
                   <AppearanceSection
                      themeId={settings.themeId}
                      setThemeId={(val) => updateSetting('themeId', val)}
                      language={settings.language}
                      setLanguage={(val) => updateSetting('language', val)}
                      isCompletionNotificationEnabled={settings.isCompletionNotificationEnabled}
                      setIsCompletionNotificationEnabled={(val) => updateSetting('isCompletionNotificationEnabled', val)}
                      baseFontSize={settings.baseFontSize}
                      setBaseFontSize={(val) => updateSetting('baseFontSize', val)}
                      expandCodeBlocksByDefault={settings.expandCodeBlocksByDefault}
                      setExpandCodeBlocksByDefault={(v) => updateSetting('expandCodeBlocksByDefault', v)}
                      isMermaidRenderingEnabled={settings.isMermaidRenderingEnabled}
                      setIsMermaidRenderingEnabled={(v) => updateSetting('isMermaidRenderingEnabled', v)}
                      isGraphvizRenderingEnabled={settings.isGraphvizRenderingEnabled ?? true}
                      setIsGraphvizRenderingEnabled={(v) => updateSetting('isGraphvizRenderingEnabled', v)}
                      isAutoScrollOnSendEnabled={settings.isAutoScrollOnSendEnabled ?? true}
                      setIsAutoScrollOnSendEnabled={(v) => updateSetting('isAutoScrollOnSendEnabled', v)}
                      t={t}
                    />
                </div>
              )}
              {activeTab === 'model' && (
                 <ChatBehaviorSection
                    modelId={settings.modelId} setModelId={(v) => updateSetting('modelId', v)}
                    transcriptionModelId={settings.transcriptionModelId} setTranscriptionModelId={(v) => updateSetting('transcriptionModelId', v)}
                    isTranscriptionThinkingEnabled={settings.isTranscriptionThinkingEnabled} setIsTranscriptionThinkingEnabled={(v) => updateSetting('isTranscriptionThinkingEnabled', v)}
                    ttsVoice={settings.ttsVoice} setTtsVoice={(v) => updateSetting('ttsVoice', v)}
                    systemInstruction={settings.systemInstruction} setSystemInstruction={(v) => updateSetting('systemInstruction', v)}
                    temperature={settings.temperature} setTemperature={(v) => updateSetting('temperature', v)}
                    topP={settings.topP} setTopP={(v) => updateSetting('topP', v)}
                    isModelsLoading={isModelsLoading}
                    modelsLoadingError={modelsLoadingError}
                    availableModels={availableModels}
                    t={t}
                />
              )}
              {activeTab === 'conversation' && (
                 <div>
                    <FeatureFlags
                      isStreamingEnabled={settings.isStreamingEnabled} setIsStreamingEnabled={(v) => updateSetting('isStreamingEnabled', v)}
                      isAutoTitleEnabled={settings.isAutoTitleEnabled} setIsAutoTitleEnabled={(v) => updateSetting('isAutoTitleEnabled', v)}
                      isSuggestionsEnabled={settings.isSuggestionsEnabled} setIsSuggestionsEnabled={(v) => updateSetting('isSuggestionsEnabled', v)}
                      isAutoSendOnSuggestionClick={settings.isAutoSendOnSuggestionClick ?? true} setIsAutoSendOnSuggestionClick={(v) => updateSetting('isAutoSendOnSuggestionClick', v)}
                      t={t}
                     />
                 </div>
              )}
              {activeTab === 'account' && (
                <ApiConfigSection
                  useCustomApiConfig={settings.useCustomApiConfig}
                  setUseCustomApiConfig={(val) => updateSetting('useCustomApiConfig', val)}
                  apiKey={settings.apiKey}
                  setApiKey={(val) => updateSetting('apiKey', val)}
                  apiProxyUrl={settings.apiProxyUrl}
                  setApiProxyUrl={(val) => updateSetting('apiProxyUrl', val)}
                  t={t}
                />
              )}
              {activeTab === 'data' && (
                 <DataManagementSection
                    onClearHistory={() => { onClearAllHistory(); onClose(); }}
                    onClearCache={onClearCache}
                    onOpenLogViewer={() => { onOpenLogViewer(); onClose(); }}
                    onInstallPwa={onInstallPwa}
                    isInstallable={isInstallable}
                    onImportSettings={onImportSettings}
                    onExportSettings={onExportSettings}
                    t={t}
                  />
              )}
              {activeTab === 'about' && ( <AboutSection t={t} /> )}
            </div>
          </div>
        </div>
        <SettingsActions onSave={handleSave} onCancel={handleClose} onReset={handleResetToDefaults} t={t} />
      </div>
    </Modal>
  );
};