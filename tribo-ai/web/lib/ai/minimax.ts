/**
 * Cliente MiniMax — via OpenAI-compatible API.
 *
 * MiniMax M2.5 é ~10x mais barato que Claude Sonnet e suporta
 * tool use (function calling) via formato OpenAI.
 *
 * Usado pelos agentes operacionais (equipe de 16).
 * Claude fica reservado para o chatbot RH (melhor PT-BR user-facing).
 *
 * Docs: https://platform.minimax.io/docs/api-reference/text-openai-api
 */

import OpenAI from "openai";

if (!process.env.MINIMAX_API_KEY) {
  console.warn(
    "[tribo-ai] MINIMAX_API_KEY não configurada. Agentes operacionais usarão mock.",
  );
}

export const minimax = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY ?? "sk-stub",
  baseURL: "https://api.minimax.io/v1",
});

export const MINIMAX_MODELS = {
  M25: "MiniMax-M2.5",
  M25_LIGHTNING: "MiniMax-M2.5-lightning",
} as const;

export type MiniMaxModel = (typeof MINIMAX_MODELS)[keyof typeof MINIMAX_MODELS];

/**
 * Custo em BRL por 1M tokens (fonte: minimax pricing abril 2026)
 * USD→BRL ~5.0
 */
export const MINIMAX_COST_PER_MTOKEN_BRL: Record<
  MiniMaxModel,
  { input: number; output: number }
> = {
  [MINIMAX_MODELS.M25]: { input: 1.5, output: 6.0 },
  [MINIMAX_MODELS.M25_LIGHTNING]: { input: 1.5, output: 12.0 },
};

export function calculateMiniMaxCostBrl(
  model: MiniMaxModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = MINIMAX_COST_PER_MTOKEN_BRL[model];
  return (
    (inputTokens * rates.input) / 1_000_000 +
    (outputTokens * rates.output) / 1_000_000
  );
}
