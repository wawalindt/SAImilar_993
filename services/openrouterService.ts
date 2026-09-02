/**
 * Legacy OpenRouter compatibility layer.
 * All requests are routed through the unified LLM Router (llmService.ts),
 * guaranteeing strict respect for the active provider (Groq vs OpenRouter) and fallback chains.
 */

import { GeminAnalysisResult, Language, AppSettings, TokenUsageData } from '../types';
import { analyzeUserQueryLLM, callLLMWithFallback, tokenLogger, SYSTEM_PROMPT } from './llmService';

export { tokenLogger, SYSTEM_PROMPT };
export type { TokenUsageData };

export const MODELS = {
  nemotron: { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nvidia Nemotron 3 Super 120B (Free)', inputCost: 0, outputCost: 0 },
  glm: { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2 (Free)', inputCost: 0, outputCost: 0 },
  laguna: { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1 (Free)', inputCost: 0, outputCost: 0 },
  lfm: { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM 2.5 2.6B (Free)', inputCost: 0, outputCost: 0 },
  north: { id: 'cohere/north-mini-code:free', name: 'North Mini Code (Free)', inputCost: 0, outputCost: 0 },
  minimax: { id: 'minimax/minimax-m2.7:free', name: 'MiniMax M2.7 (Free)', inputCost: 0, outputCost: 0 },
  ling: { id: 'inclusionai/ling-3.0-flash-fin:free', name: 'Ling 3.0 Flash Fin (Free)', inputCost: 0, outputCost: 0 },
};

export type ModelName = keyof typeof MODELS;

export const getAvailableModels = () => {
  return Object.entries(MODELS).map(([key, config]) => ({
    key: key as ModelName,
    name: config.name,
  }));
};

/**
 * Routes through the unified LLM Service with multi-model fallback.
 * Strictly respects the user's selected provider (Groq or OpenRouter).
 */
export const analyzeUserQueryOpenRouter = async (
  query: string,
  history: string[],
  language: Language = 'ru',
  _model?: ModelName,
  settings?: AppSettings
): Promise<GeminAnalysisResult & { usage?: TokenUsageData }> => {
  return await analyzeUserQueryLLM(query, history, language, settings);
};

/**
 * Single prompt caller routed through unified LLM Service.
 */
export const callOpenRouterAPI = async (
  prompt: string,
  _model?: ModelName,
  settings?: AppSettings
): Promise<{ response: string; usage: TokenUsageData }> => {
  const result = await callLLMWithFallback({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 3000,
    settings,
  });

  const usage: TokenUsageData = {
    model: result.usedModel,
    inputTokens: result.usage?.inputTokens || 0,
    outputTokens: result.usage?.outputTokens || 0,
    totalTokens: result.usage?.totalTokens || 0,
    cost: 0,
    timestamp: new Date(),
    query: prompt.substring(0, 100),
    responseTime: result.usage?.responseTime || 0,
  };

  return {
    response: result.content,
    usage,
  };
};
