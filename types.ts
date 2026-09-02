
// === User Types ===
export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  passwordHash?: string;
  provider: 'local' | 'google';
  createdAt: number;
  userRating?: number;
  wishlistCount?: number;
  watchedCount?: number;
  role?: string; // 'owner', 'admin', 'editor', 'viewer', 'user'
}

// === AI Types ===
export type Language = 'ru' | 'en';
export type MediaType = 'movie' | 'tv' | 'anime';
export type AIProvider = 'gemini' | 'openrouter';
export type LLMProvider = 'groq' | 'openrouter';

export interface ModelConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export interface ProviderModelsConfig {
  groq: ModelConfig[];
  openrouter: ModelConfig[];
}

export interface LLMAttemptLog {
  provider: LLMProvider;
  model: string;
  attempt: number;
  status: 'SUCCESS' | 'ERROR';
  statusCode?: number;
  error?: string;
  latency: number;
  fallback_used: boolean;
  timestamp: number;
}

// === Movie Types ===
export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  media_type: MediaType;
  original_language: string;
  director?: string;
  cast?: string[];
  genres?: Array<{ id: number; name: string }>;
  runtime?: number;
  userRating?: number; // User's personal rating
}

export interface AppSettings {
  provider?: AIProvider;
  llmProvider: LLMProvider;
  modelsConfig: ProviderModelsConfig;
  language: 'ru' | 'en';
  theme: 'dark' | 'light'; // Added theme
  activeModel?: string; // Currently selected model
  apiKeys?: {
    groq?: string;
    openrouter?: string;
    gemini?: string;
    tmdb?: string;
  };
  // Internal override for testing specific models
  modelOverride?: string;
}

// === Analysis Result Types ===
export interface GeminAnalysisResult {
  query_type: 'TYPE_1_DESCRIPTIVE' | 'TYPE_2_SPECIFIC_FILM' | 'TYPE_3_GENERAL';
  media_type: 'movie' | 'tv' | 'anime';
  recommended_titles: string[];
  search_parameters: {
    genres?: string[];
    similar_to_movie?: string;
    mood?: string;
    keywords?: string[];
  };
  chat_response: string;
  suggested_filters: Array<{
    category: string;
    label: string;
    value: string;
    selected?: boolean;
  }>;
  isFallback?: boolean;
  usage?: TokenUsageData;
  usedModel?: string;
  usedProvider?: LLMProvider;
  attempts?: LLMAttemptLog[];
  fallback_used?: boolean;
}

export interface MovieSummary {
  summary: string;
  tone: string;
  spoiler_risk: number;
}

// === Chat Types ===
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedFilters?: Array<{
    category: string;
    label: string;
    value: string;
    selected: boolean;
  }>;
}

// === Filter Types ===
export interface FilterOption {
  category: string;
  label: string;
  value: string;
  selected: boolean;
}

// === State Types ===
export interface SearchHistoryState {
  query: string;
  movies: Movie[];
  messages: ChatMessage[];
  viewMode: 'recommendations' | 'wishlist' | 'watched';
}

// === Token Tracking Type ===
export interface TokenUsageData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
  query: string;
  responseTime: number;
}

// === Test Log Type ===
export interface TestLogEntry {
  id: string;
  timestamp: number;
  model: string;
  query: string;
  provider?: LLMProvider;
  fallback_used?: boolean;
  attempts?: LLMAttemptLog[];
  response?: GeminAnalysisResult;
  error?: string;
  metadata?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    responseTime: number;
  };
}
