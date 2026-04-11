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
 */
export const COST_PER_MTOKEN_BRL: Record<ModelName, { input: number; output: number }> = {
  [MODELS.SONNET]: { input: 15, output: 75 },
  [MODELS.HAIKU]: { input: 1.5, output: 7.5 },
  [MODELS.OPUS]: { input: 75, output: 375 },
};

export function calculateCostBrl(
  model: ModelName,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = COST_PER_MTOKEN_BRL[model];
  return (
    (inputTokens * rates.input) / 1_000_000 +
    (outputTokens * rates.output) / 1_000_000
  );
}
