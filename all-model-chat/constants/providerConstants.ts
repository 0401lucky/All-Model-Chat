import { ProviderConfig } from '../types';

// Provider IDs
export const PROVIDER_IDS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  CUSTOM: 'custom'
} as const;

// Default provider configurations
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: PROVIDER_IDS.GEMINI,
    name: 'Google Gemini',
    enabled: true,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },
  {
    id: PROVIDER_IDS.OPENAI,
    name: 'OpenAI',
    enabled: false,
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    id: PROVIDER_IDS.ANTHROPIC,
    name: 'Anthropic Claude',
    enabled: false,
    baseUrl: 'https://api.anthropic.com/v1'
  }
];

// Popular models for each provider (for fallback if API call fails)
export const FALLBACK_MODELS = {
  [PROVIDER_IDS.GEMINI]: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', providerId: PROVIDER_IDS.GEMINI, providerName: 'Google Gemini' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', providerId: PROVIDER_IDS.GEMINI, providerName: 'Google Gemini' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', providerId: PROVIDER_IDS.GEMINI, providerName: 'Google Gemini' }
  ],
  [PROVIDER_IDS.OPENAI]: [
    { id: 'gpt-4o', name: 'GPT-4o', providerId: PROVIDER_IDS.OPENAI, providerName: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: PROVIDER_IDS.OPENAI, providerName: 'OpenAI' },
    { id: 'gpt-4', name: 'GPT-4', providerId: PROVIDER_IDS.OPENAI, providerName: 'OpenAI' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', providerId: PROVIDER_IDS.OPENAI, providerName: 'OpenAI' }
  ],
  [PROVIDER_IDS.ANTHROPIC]: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', providerId: PROVIDER_IDS.ANTHROPIC, providerName: 'Anthropic Claude' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', providerId: PROVIDER_IDS.ANTHROPIC, providerName: 'Anthropic Claude' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', providerId: PROVIDER_IDS.ANTHROPIC, providerName: 'Anthropic Claude' }
  ]
};

// Provider-specific features
export const PROVIDER_FEATURES = {
  [PROVIDER_IDS.GEMINI]: {
    supportsImages: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFileUpload: true,
    supportsThinking: true,
    supportsTools: true,
    defaultTemperature: 1.0,
    defaultTopP: 0.95
  },
  [PROVIDER_IDS.OPENAI]: {
    supportsImages: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFileUpload: false,
    supportsThinking: false,
    supportsTools: true,
    defaultTemperature: 0.7,
    defaultTopP: 1.0
  },
  [PROVIDER_IDS.ANTHROPIC]: {
    supportsImages: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFileUpload: false,
    supportsThinking: false,
    supportsTools: true,
    defaultTemperature: 0.7,
    defaultTopP: 1.0
  }
};

// Authentication types for each provider
export const PROVIDER_AUTH_TYPES = {
  [PROVIDER_IDS.GEMINI]: 'api-key',
  [PROVIDER_IDS.OPENAI]: 'bearer-token',
  [PROVIDER_IDS.ANTHROPIC]: 'x-api-key'
} as const;

// Default model for new users
export const DEFAULT_PROVIDER_ID = PROVIDER_IDS.GEMINI;
export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';