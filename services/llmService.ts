/**
 * Unified LLM Service with multi-model Fallback
 * Handles Groq and OpenRouter providers with prioritized fallback chains.
 */

import {
  AppSettings,
  GeminAnalysisResult,
  Language,
  LLMAttemptLog,
  LLMProvider,
  MovieSummary,
  TokenUsageData,
} from '../types';
import { DEFAULT_MODELS_CONFIG } from './storageService';

// System prompt for film curation
export const SYSTEM_PROMPT = `
You are SAImilar, a world-class movie and TV curator.
You DO NOT just search for keywords. You understand the "vibe" and specific topics.

YOUR GOALS:

1. **Analyze the Request**:
- Is it a new topic? (e.g., "movies about space")
- Is it a refinement of the previous topic? (e.g., "make it scary", "add thriller", "remove old movies")
- **CRITICAL**: If it is a refinement, you MUST MERGE it with the previous topic found in the History.
- Do not lose the original context (e.g. if history was "shipwrecks" and user adds "thriller", look for "shipwreck thrillers").

2. **Determine Media Type**:
- 'movie': Live action movies. (Do NOT include TV series or Anime unless asked).
- 'tv': TV Series.
- 'anime': Japanese animation.
- **STRICT SEPARATION**: If user asks for "movies", do NOT suggest TV shows or Anime.

3. **Generate Recommendations**:
- **PRIMARY METHOD**: Generate a list of 5-10 SPECIFIC \`recommended_titles\` (in English or original film titles) that perfectly match the user's need.
- This is the most important part. You are the recommendation engine.
- For "shipwrecks", examples: "Titanic", "Life of Pi", "Cast Away", "Triangle of Sadness", "The Perfect Storm".
- Do NOT just search for the word "shipwreck". Find films *about* it.

4. **Output Format**:
- JSON only.

STRUCTURE:
{
  "query_type": "TYPE_1_DESCRIPTIVE" | "TYPE_2_SPECIFIC_FILM" | "TYPE_3_GENERAL",
  "media_type": "movie" | "tv" | "anime",
  "recommended_titles": ["Title 1", "Title 2", ...],
  "search_parameters": {
    "genres": [...],
    "similar_to_movie": "string (only if TYPE_2)",
    "mood": "string"
  },
  "chat_response": "Short friendly text in the requested language...",
  "suggested_filters": [
    { "category": "Genre", "label": "Label in Language", "value": "genre_keyword" }
  ]
}
`;

// In-memory token & attempt logger for diagnostics
class TokenLogger {
  private logs: TokenUsageData[] = [];
  private readonly maxLogs = 1000;

  log(data: TokenUsageData) {
    this.logs.push(data);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getLogs(): TokenUsageData[] {
    return [...this.logs];
  }
}

export const tokenLogger = new TokenLogger();

// Redact secret keys from strings
export function sanitizeError(msg: any): string {
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    } catch {
      msg = String(msg);
    }
  }
  return msg
    .replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_GROQ_KEY]')
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED_KEY]')
    .replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED_GOOGLE_KEY]');
}

// Ensure proper alternating roles for chat completion APIs
function sanitizeMessages(messages: any[]) {
  const sanitized: any[] = [];
  const systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    sanitized.push(systemMsg);
  }

  const conversation = messages
    .filter(m => m.role !== 'system')
    .filter(m => m.content && m.content.trim() !== '');

  if (conversation.length > 0 && conversation[0].role === 'assistant') {
    conversation.shift();
  }

  for (const msg of conversation) {
    if (sanitized.length === (systemMsg ? 1 : 0)) {
      sanitized.push(msg);
      continue;
    }
    const lastMsg = sanitized[sanitized.length - 1];
    if (msg.role === lastMsg.role) {
      lastMsg.content += '\n\n' + msg.content;
    } else {
      sanitized.push(msg);
    }
  }
  return sanitized;
}

export interface LLMCallRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  settings?: AppSettings;
  timeoutMs?: number;
}

export interface LLMCallResponse {
  content: string;
  usedProvider: LLMProvider;
  usedModel: string;
  fallbackUsed: boolean;
  attempts: LLMAttemptLog[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    responseTime: number;
  };
}

/**
 * Core LLM execution function with fallback
 * 1. Takes user-selected provider (default 'groq')
 * 2. Takes its models in specified order
 * 3. Skips blocked (enabled === false) models
 * 4. Calls first active model
 * 5. On success, finishes
 * 6. On error (429, 5xx, timeout, network error, 404, model_not_found), moves to next model
 * 7. Repeats until success or end of active models list
 * Never alters prompt across fallback attempts
 * Never loops infinitely
 */
export async function callLLMWithFallback(
  req: LLMCallRequest
): Promise<LLMCallResponse> {
  const provider: LLMProvider = req.settings?.llmProvider === 'openrouter' ? 'openrouter' : 'groq';
  const allModels = req.settings?.modelsConfig?.[provider] || DEFAULT_MODELS_CONFIG[provider];
  
  // Filter only enabled models
  const activeModels = allModels.filter(m => m.enabled);

  if (activeModels.length === 0) {
    const providerName = provider === 'groq' ? 'Groq' : 'OpenRouter';
    throw new Error(
      `Все модели ${providerName} выключены (✕). Пожалуйста, включите хотя бы одну модель в настройках.`
    );
  }

  const sanitizedMsgs = sanitizeMessages(req.messages);
  const attempts: LLMAttemptLog[] = [];
  let lastError: Error | null = null;

  for (let i = 0; i < activeModels.length; i++) {
    const currentModel = activeModels[i];
    const attempt = i + 1;
    const fallback_used = i > 0;
    const startTime = Date.now();
    const endpoint = `/api/${provider}`;

    try {
      const controller = new AbortController();
      const timeoutMs = req.timeoutMs || 30000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: currentModel.id,
          messages: sanitizedMsgs,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.max_tokens ?? 3000,
          response_format: req.response_format,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latency = Date.now() - startTime;

      if (!response.ok) {
        let errJson: any = null;
        try {
          errJson = await response.json();
        } catch {
          try {
            errJson = { error: await response.text() };
          } catch {}
        }

        const status = response.status;
        const rawErrorMsg = errJson?.error || errJson?.message || `HTTP ${status}`;
        const safeErrorMsg = sanitizeError(rawErrorMsg);

        const attemptLog: LLMAttemptLog = {
          provider,
          model: currentModel.id,
          attempt,
          status: 'ERROR',
          statusCode: status,
          error: safeErrorMsg,
          latency,
          fallback_used,
          timestamp: Date.now(),
        };
        attempts.push(attemptLog);

        // Required Structured Log
        console.warn(
          `[LLM Call] → provider: ${provider} → model: ${currentModel.id} | attempt: ${attempt} | status: ERROR ${status} | latency: ${latency}ms | fallback_used: ${fallback_used}`
        );

        lastError = new Error(`[${provider} / ${currentModel.id}]: ${safeErrorMsg}`);
        // Transition to next model
        continue;
      }

      const data = await response.json();
      const latencySuccess = Date.now() - startTime;
      const content = data.choices?.[0]?.message?.content || '';

      const attemptLog: LLMAttemptLog = {
        provider,
        model: currentModel.id,
        attempt,
        status: 'SUCCESS',
        statusCode: 200,
        latency: latencySuccess,
        fallback_used,
        timestamp: Date.now(),
      };
      attempts.push(attemptLog);

      // Required Structured Log
      console.log(
        `[LLM Call] → provider: ${provider} → model: ${currentModel.id} | attempt: ${attempt} | status: SUCCESS | latency: ${latencySuccess}ms | fallback_used: ${fallback_used}`
      );

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;

      return {
        content,
        usedProvider: provider,
        usedModel: currentModel.id,
        fallbackUsed: fallback_used,
        attempts,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cost: 0,
          responseTime: latencySuccess,
        },
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errorMsg = isTimeout ? 'Timeout exceeded (30s)' : (err?.message || 'Network error');
      const safeErrorMsg = sanitizeError(errorMsg);

      const attemptLog: LLMAttemptLog = {
        provider,
        model: currentModel.id,
        attempt,
        status: 'ERROR',
        statusCode: isTimeout ? 408 : 0,
        error: safeErrorMsg,
        latency,
        fallback_used,
        timestamp: Date.now(),
      };
      attempts.push(attemptLog);

      // Required Structured Log
      console.warn(
        `[LLM Call] → provider: ${provider} → model: ${currentModel.id} | attempt: ${attempt} | status: ERROR ${isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'} | latency: ${latency}ms | fallback_used: ${fallback_used}`
      );

      lastError = new Error(`[${provider} / ${currentModel.id}]: ${safeErrorMsg}`);
      // Transition to next model
      continue;
    }
  }

  // All active models exhausted
  const failureSummary = attempts
    .map(a => `#${a.attempt} (${a.model}): ${a.status} ${a.statusCode || ''} ${a.error || ''}`)
    .join('; ');

  throw new Error(
    `Все модели ${provider} завершились ошибкой. Попытки: [${failureSummary}]. Последняя ошибка: ${lastError?.message || 'Неизвестная ошибка'}`
  );
}

function sanitizeAnalysisResult(data: any): GeminAnalysisResult {
  return {
    query_type: data.query_type || 'TYPE_1_DESCRIPTIVE',
    media_type: ['movie', 'tv', 'anime'].includes(data.media_type) ? data.media_type : 'movie',
    recommended_titles: Array.isArray(data.recommended_titles)
      ? data.recommended_titles.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      : [],
    search_parameters: (data.search_parameters && typeof data.search_parameters === 'object') ? data.search_parameters : {},
    chat_response: typeof data.chat_response === 'string' ? data.chat_response : (typeof data.message === 'string' ? data.message : ''),
    suggested_filters: Array.isArray(data.suggested_filters) ? data.suggested_filters : []
  };
}

function parseOrExtractAnalysisResult(content: string): GeminAnalysisResult {
  let clean = (content || '').trim();
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return sanitizeAnalysisResult(parsed);
    }
  } catch {}

  // 2. Extract JSON between first '{' and last '}'
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSub = clean.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonSub);
      if (parsed && typeof parsed === 'object') {
        return sanitizeAnalysisResult(parsed);
      }
    } catch {}

    const fixedJson = jsonSub.replace(/,\s*([}\]])/g, '$1');
    try {
      const parsed = JSON.parse(fixedJson);
      if (parsed && typeof parsed === 'object') {
        return sanitizeAnalysisResult(parsed);
      }
    } catch {}
  }

  // 3. Fallback: extract movie titles from quotes/lists
  const titles: string[] = [];
  const quoteRegex = /["«“]([^"»”\n]{2,60})["»”]/g;
  let match;
  while ((match = quoteRegex.exec(clean)) !== null) {
    const title = match[1].trim();
    const forbidden = ['movie', 'tv', 'anime', 'TYPE_1_DESCRIPTIVE', 'TYPE_2_SPECIFIC_FILM', 'TYPE_3_GENERAL', 'recommended_titles', 'chat_response', 'json'];
    if (title && !titles.includes(title) && !forbidden.includes(title)) {
      titles.push(title);
    }
  }

  const listRegex = /(?:^|\n)\s*(?:\d+[\.\)]|\*|-)\s+([^\n\(\:\.]{2,50})/g;
  while ((match = listRegex.exec(clean)) !== null) {
    const title = match[1].trim().replace(/^["«“]|["»”]$/g, '');
    if (title && !titles.includes(title) && title.length < 50) {
      titles.push(title);
    }
  }

  return {
    query_type: 'TYPE_1_DESCRIPTIVE',
    media_type: 'movie',
    recommended_titles: titles.slice(0, 10),
    search_parameters: {},
    chat_response: clean || 'Вот подходящие фильмы по вашему запросу.',
    suggested_filters: []
  };
}

/**
 * Main application entry point for AI query analysis
 * Used across the entire application business logic.
 */
export async function analyzeUserQueryLLM(
  query: string,
  history: string[],
  language: Language = 'ru',
  settings?: AppSettings
): Promise<GeminAnalysisResult & {
  usage?: TokenUsageData;
  usedModel?: string;
  usedProvider?: LLMProvider;
  attempts?: LLMAttemptLog[];
  fallback_used?: boolean;
}> {
  const recentHistory = history.slice(-6);
  const langInstruction = language === 'ru'
    ? "IMPORTANT: The 'chat_response' and 'label' in 'suggested_filters' MUST BE IN RUSSIAN. 'recommended_titles' MUST be in English or original film titles."
    : "IMPORTANT: The 'chat_response' and 'label' in 'suggested_filters' MUST BE IN ENGLISH. 'recommended_titles' MUST be in English or original film titles.";

  const formatInstruction = "\n\nCRITICAL: Respond ONLY with a valid JSON object strictly matching the schema. All conversational commentary, advice, and greetings MUST be placed inside the 'chat_response' property of the JSON object. Do not output any text outside the JSON object.";

  const rawMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT + '\n' + langInstruction + formatInstruction },
    ...recentHistory.map(h => {
      const match = h.match(/^(user|assistant):\s*(.*)/s);
      return match
        ? { role: match[1] as 'user' | 'assistant', content: match[2] }
        : { role: 'user' as const, content: h };
    }),
    { role: 'user' as const, content: query }
  ];

  const llmResult = await callLLMWithFallback({
    messages: rawMessages,
    temperature: 0.7,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    settings,
  });

  const parsed = parseOrExtractAnalysisResult(llmResult.content);

  const usageData: TokenUsageData = {
    model: llmResult.usedModel,
    inputTokens: llmResult.usage?.inputTokens || 0,
    outputTokens: llmResult.usage?.outputTokens || 0,
    totalTokens: llmResult.usage?.totalTokens || 0,
    cost: 0,
    timestamp: new Date(),
    query: query.substring(0, 100),
    responseTime: llmResult.usage?.responseTime || 0,
  };
  tokenLogger.log(usageData);

  return {
    ...parsed,
    usage: usageData,
    usedModel: llmResult.usedModel,
    usedProvider: llmResult.usedProvider,
    attempts: llmResult.attempts,
    fallback_used: llmResult.fallbackUsed,
  };
}

/**
 * Generate spoiler-free movie summary using LLM fallback
 */
export async function generateSummaryLLM(
  movieTitle: string,
  movieData: any,
  language: Language = 'ru',
  settings?: AppSettings
): Promise<MovieSummary> {
  const langInstruction = language === 'ru'
    ? 'WRITE THE SUMMARY IN RUSSIAN.'
    : 'WRITE THE SUMMARY IN ENGLISH.';

  const prompt = `
TASK: Write a gripping, SPOILER-FREE summary for the title "${movieTitle}".
Data: ${JSON.stringify(movieData)}

RULES:
1. One sentence capturing the MAIN SENSATION.
2. 2-3 sentences on what happens (DIRECTION/ATMOSPHERE only, NO PLOT TWISTS).
3. Describe the TONE.
4. Suggest who it is for.
5. NO SPOILERS.
6. ${langInstruction}

Respond ONLY with valid JSON:
{
  "summary": "...",
  "tone": "...",
  "spoiler_risk": 0.0
}
  `;

  const llmResult = await callLLMWithFallback({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    settings,
  });

  let cleaned = llmResult.content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as MovieSummary;
  } catch {
    return {
      summary: llmResult.content || (language === 'ru' ? 'Описание недоступно.' : 'No summary available.'),
      tone: 'Unknown',
      spoiler_risk: 0,
    };
  }
}
