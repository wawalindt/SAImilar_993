/**
 * Unified AI Analysis Service
 * Supports both Gemini and OpenRouter via Vercel Proxy or Direct Call
 */

import { GeminAnalysisResult, MovieSummary, Language, AppSettings, TokenUsageData } from '../types';
import { getCachedSummary, cacheSummary } from './storageService';
import { analyzeUserQueryLLM, generateSummaryLLM, SYSTEM_PROMPT, tokenLogger } from './llmService';

export { SYSTEM_PROMPT, tokenLogger };
export type { TokenUsageData };

/**
 * Main application query analyzer using unified LLM Service with fallback
 */
export const analyzeUserQuery = async (
  query: string,
  history: string[],
  language: Language = 'ru',
  settings?: AppSettings
): Promise<GeminAnalysisResult & { usage?: TokenUsageData }> => {
  return await analyzeUserQueryLLM(query, history, language, settings);
};

/**
 * Generate spoiler-free summary using unified LLM Service with fallback
 */
export const generateSpoilerFreeSummary = async (
  movieTitle: string,
  movieData: any,
  language: Language = 'ru',
  settings?: AppSettings
): Promise<MovieSummary> => {
  const cached = getCachedSummary(movieData.id, language);
  if (cached) {
    return cached;
  }

  try {
    const summary = await generateSummaryLLM(movieTitle, movieData, language, settings);
    cacheSummary(movieData.id, language, summary);
    return summary;
  } catch (error) {
    console.error("Error generating summary:", error);
    return {
      summary: movieData.overview || (language === 'ru' ? "Описание недоступно." : "No summary available."),
      tone: "Unknown",
      spoiler_risk: 0
    };
  }
};

