/**
 * Budget — controla gastos por crew e pausa se exceder limite diário.
 */

import type { Crew } from "./types";

const DAILY_BUDGET_BRL: Record<Crew, number> = {
  leadership: 10,
  sales: 30,
  customer_success: 20,
  support: 15,
  marketing: 40,
  operations: 10,
};

const dailySpend: Record<string, number> = {};
let lastResetDate = "";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureReset() {
  const today = todayKey();
  if (lastResetDate !== today) {
    for (const key of Object.keys(dailySpend)) {
      dailySpend[key] = 0;
    }
    lastResetDate = today;
  }
}

export function trackSpend(crew: Crew, costBrl: number) {
  ensureReset();
  dailySpend[crew] = (dailySpend[crew] ?? 0) + costBrl;
}

export function canSpend(crew: Crew): boolean {
  ensureReset();
  const spent = dailySpend[crew] ?? 0;
  const limit = DAILY_BUDGET_BRL[crew] ?? 10;
  return spent < limit;
}

export function getSpend(crew: Crew): { spent: number; limit: number; pct: number } {
  ensureReset();
  const spent = dailySpend[crew] ?? 0;
  const limit = DAILY_BUDGET_BRL[crew] ?? 10;
  return { spent, limit, pct: limit > 0 ? spent / limit : 0 };
}

export function getAllBudgets(): Record<Crew, { spent: number; limit: number; pct: number }> {
  ensureReset();
  const crews: Crew[] = ["leadership", "sales", "customer_success", "support", "marketing", "operations"];
  const result = {} as Record<Crew, { spent: number; limit: number; pct: number }>;
  for (const c of crews) {
    result[c] = getSpend(c);
  }
  return result;
}
