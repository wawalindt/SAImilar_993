
import { MovieSummary, AppSettings, ProviderModelsConfig } from '../types';

const KEYS = {
  SETTINGS: 'saimilar_settings',
  CACHE_SUMMARIES: 'saimilar_cache_summaries',
};

const CACHE_TTL = 1000 * 60 * 60 * 24 * 3; // 3 Days

export const DEFAULT_MODELS_CONFIG: ProviderModelsConfig = {
  groq: [
    { id: 'allam-2-7b', name: 'ALLAM 2 7B', enabled: true },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', enabled: true },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', enabled: true },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', enabled: true },
    { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', enabled: false },
  ],
  openrouter: [
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nvidia Nemotron 3 Super 120B (Free)', enabled: true },
    { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2 (Free)', enabled: true },
    { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1 (Free)', enabled: true },
    { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM 2.5 2.6B (Free)', enabled: true },
    { id: 'cohere/north-mini-code:free', name: 'North Mini Code (Free)', enabled: true },
    { id: 'minimax/minimax-m2.7:free', name: 'MiniMax M2.7 (Free)', enabled: true },
    { id: 'inclusionai/ling-3.0-flash-fin:free', name: 'Ling 3.0 Flash Fin (Free)', enabled: true },
  ],
};

export const getDefaultSettings = (): AppSettings => ({
  llmProvider: 'groq',
  modelsConfig: {
    groq: [...DEFAULT_MODELS_CONFIG.groq.map(m => ({ ...m }))],
    openrouter: [...DEFAULT_MODELS_CONFIG.openrouter.map(m => ({ ...m }))],
  },
  apiKeys: {},
  language: 'ru',
  theme: 'dark',
  activeModel: 'allam-2-7b'
});

// --- SETTINGS (Global Device Settings - Stored Locally) ---

export const getSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    const defaults = getDefaultSettings();
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    const llmProvider = (parsed.llmProvider === 'openrouter' || parsed.llmProvider === 'groq')
      ? parsed.llmProvider
      : 'groq';

    // Merge modelsConfig to preserve user order and enabled flags while ensuring all models exist
    const mergeProviderModels = (provider: 'groq' | 'openrouter') => {
      const savedList: any[] = parsed.modelsConfig?.[provider];
      const defaultList = DEFAULT_MODELS_CONFIG[provider];
      if (!Array.isArray(savedList) || savedList.length === 0) {
        return defaultList.map(m => ({ ...m }));
      }

      // Keep user's models and order (strictly filter out models not present in current defaultList)
      const result: typeof defaultList = [];
      for (const item of savedList) {
        if (item && item.id) {
          const matchedDef = defaultList.find(d => d.id === item.id);
          if (!matchedDef) continue; // strictly skip any old/unrecognized model
          result.push({
            id: item.id,
            name: matchedDef.name,
            enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
          });
        }
      }

      // Add any missing default models that weren't in saved list
      for (const def of defaultList) {
        if (!result.some(r => r.id === def.id)) {
          result.push({ ...def });
        }
      }

      return result;
    };

    return {
      ...defaults,
      ...parsed,
      llmProvider,
      modelsConfig: {
        groq: mergeProviderModels('groq'),
        openrouter: mergeProviderModels('openrouter'),
      },
    };
  } catch {
    return getDefaultSettings();
  }
};

export const saveSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save settings to localStorage", e);
  }
};

// --- CACHING (Global) ---

interface CacheEntry<T> { data: T; timestamp: number; }

export const getCachedSummary = (movieId: number, lang: string): MovieSummary | null => {
  try {
    const key = `${movieId}_${lang}`;
    const cacheRaw = localStorage.getItem(KEYS.CACHE_SUMMARIES);
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw) as Record<string, CacheEntry<MovieSummary>>;
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry.data;
  } catch { return null; }
};

export const cacheSummary = (movieId: number, lang: string, summary: MovieSummary) => {
  try {
    const key = `${movieId}_${lang}`;
    const cacheRaw = localStorage.getItem(KEYS.CACHE_SUMMARIES);
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    cache[key] = { data: summary, timestamp: Date.now() };
    localStorage.setItem(KEYS.CACHE_SUMMARIES, JSON.stringify(cache));
  } catch (e) { console.warn("Cache quota"); }
};
