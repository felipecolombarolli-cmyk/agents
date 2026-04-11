/**
 * Cliente centralizado do Anthropic Claude.
 *
 * Usado por:
 * - Chatbot de RH (/api/chat/stream)
 * - Análise de sentimento de pesquisas
 * - Agentes operacionais
 */

import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[tribo-ai] ANTHROPIC_API_KEY não configurada. Chamadas à IA falharão.",
  );
}

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

// Modelos disponíveis — use sempre as constantes, nunca hardcoded
export const MODELS = {
  SONNET: "claude-sonnet-4-6",
  HAIKU: "claude-haiku-4-5-20251001",
  OPUS: "claude-opus-4-6",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * Aprox. BRL por 1M tokens (atualizar conforme pricing Anthropic).
 * Usado para tracking de custo por sessão/tenant.
 *
 * Prompt caching reduz o custo de input para ~10% (cache read) após
 * o primeiro hit. Cache creation custa 25% a mais que input normal.
 */
export const COST_PER_MTOKEN_BRL: Record<
  ModelName,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  [MODELS.SONNET]: {
    input: 15,
    output: 75,
    cacheWrite: 18.75, // 1.25x input
    cacheRead: 1.5, // 0.1x input
  },
  [MODELS.HAIKU]: {
    input: 1.5,
    output: 7.5,
    cacheWrite: 1.875,
    cacheRead: 0.15,
  },
  [MODELS.OPUS]: {
    input: 75,
    output: 375,
    cacheWrite: 93.75,
    cacheRead: 7.5,
  },
};

export interface CacheUsage {
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export function calculateCostBrl(
  model: ModelName,
  inputTokens: number,
  outputTokens: number,
  cache?: CacheUsage,
): number {
  const rates = COST_PER_MTOKEN_BRL[model];
  const cacheCreation = cache?.cacheCreationTokens ?? 0;
  const cacheRead = cache?.cacheReadTokens ?? 0;

  // Tokens de input "normais" excluem os que viraram cache
  const normalInput = Math.max(inputTokens - cacheCreation - cacheRead, 0);

  return (
    (normalInput * rates.input) / 1_000_000 +
    (outputTokens * rates.output) / 1_000_000 +
    (cacheCreation * rates.cacheWrite) / 1_000_000 +
    (cacheRead * rates.cacheRead) / 1_000_000
  );
}
