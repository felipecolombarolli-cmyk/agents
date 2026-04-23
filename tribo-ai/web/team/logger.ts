/**
 * Logger — persiste cada execução de agente no AgentLog.
 */

import { prisma } from "../lib/db";
import type { AgentDefinition, AgentResult } from "./types";

export async function logAgentExecution(
  agent: AgentDefinition,
  result: AgentResult,
): Promise<void> {
  try {
    await prisma.agentLog.create({
      data: {
        agentId: agent.id,
        crew: agent.crew,
        eventName: result.eventName,
        success: result.success,
        output: typeof result.output === "string"
          ? { text: result.output }
          : (result.output as object) ?? undefined,
        toolCalls: result.toolCalls as object[],
        costBrl: result.costBrl,
        tokensIn: result.tokensUsed.input,
        tokensOut: result.tokensUsed.output,
        durationMs: result.durationMs,
        escalated: !!result.escalated,
        error: result.error ?? null,
      },
    });
  } catch (err) {
    console.error(`[logger] Falha ao logar execução de ${agent.id}:`, err);
  }
}

export async function getRecentLogs(limit = 50) {
  return prisma.agentLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getDailyStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const logs = await prisma.agentLog.findMany({
    where: { createdAt: { gte: todayStart } },
  });

  const totalCost = logs.reduce((s, l) => s + l.costBrl, 0);
  const totalRuns = logs.length;
  const successRate = totalRuns > 0
    ? logs.filter((l) => l.success).length / totalRuns
    : 1;
  const escalations = logs.filter((l) => l.escalated).length;

  const byCrew: Record<string, { runs: number; cost: number }> = {};
  for (const log of logs) {
    const c = byCrew[log.crew] ?? { runs: 0, cost: 0 };
    c.runs++;
    c.cost += log.costBrl;
    byCrew[log.crew] = c;
  }

  return { totalCost, totalRuns, successRate, escalations, byCrew };
}
