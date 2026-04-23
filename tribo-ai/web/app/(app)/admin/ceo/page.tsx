/**
 * /admin/ceo — Dashboard do CEO
 *
 * Ponto central de supervisão: escalations, activity feed, métricas, budget.
 * Apenas o owner do tenant acessa.
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDailyStats } from "@/team/logger";
import { getAllBudgets } from "@/team/budget";

export const dynamic = "force-dynamic";

async function resolveEscalationAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (!session.user.isOwner) return;
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  await prisma.escalation.update({
    where: { id },
    data: {
      status: action === "resolve" ? "RESOLVED" : "DISMISSED",
      resolvedAt: new Date(),
      assignedTo: session.user.id,
    },
  });
  revalidatePath("/admin/ceo");
}

export default async function CEODashboardPage() {
  const session = await requireSession();
  if (!session.user.isOwner) redirect("/feed");

  const [escalations, recentLogs, stats] = await Promise.all([
    prisma.escalation.findMany({
      where: { status: "OPEN" },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.agentLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getDailyStats(),
  ]);

  const budgets = getAllBudgets();

  const priColor: Record<string, string> = {
    P0: "bg-red-100 text-red-800 border-red-200",
    P1: "bg-amber-100 text-amber-800 border-amber-200",
    P2: "bg-blue-100 text-blue-800 border-blue-200",
    P3: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <main className="max-w-6xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          CEO Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Supervisão da equipe de agentes · {session.tenant.displayName}
        </p>
      </header>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Execuções hoje" value={stats.totalRuns} />
        <Kpi
          label="Taxa de sucesso"
          value={`${(stats.successRate * 100).toFixed(0)}%`}
        />
        <Kpi label="Custo hoje" value={`R$ ${stats.totalCost.toFixed(2)}`} />
        <Kpi label="Escalations" value={escalations.length} />
        <Kpi
          label="Crews ativas"
          value={Object.values(stats.byCrew).filter((c) => c.runs > 0).length}
        />
      </div>

      {/* Budget por crew */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">
          💰 Budget diário por crew
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(
            Object.entries(budgets) as [
              string,
              { spent: number; limit: number; pct: number },
            ][]
          ).map(([crew, b]) => (
            <div key={crew} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="capitalize">{crew.replace("_", " ")}</span>
                <span className="text-gray-500">
                  R$ {b.spent.toFixed(2)} / {b.limit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    b.pct > 0.9
                      ? "bg-red-500"
                      : b.pct > 0.6
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(b.pct * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Escalations */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">
            📬 Escalations ({escalations.length})
          </h2>
          {escalations.length === 0 ? (
            <p className="text-green-600 text-sm">
              Tudo sob controle — inbox vazia
            </p>
          ) : (
            <ul className="space-y-3">
              {escalations.map((e) => (
                <li
                  key={e.id}
                  className={`border rounded-lg p-3 ${priColor[e.priority] ?? priColor.P3}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-[10px] font-bold uppercase">
                        {e.priority}
                      </span>
                      <p className="font-medium text-sm mt-0.5">{e.title}</p>
                      <p className="text-xs mt-1 opacity-80">{e.summary}</p>
                      <p className="text-[10px] mt-1 opacity-60">
                        de {e.source} ·{" "}
                        {e.createdAt.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <form action={resolveEscalationAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="action" value="resolve" />
                        <button
                          type="submit"
                          className="text-[10px] px-2 py-1 bg-green-600 text-white rounded"
                        >
                          ✓ OK
                        </button>
                      </form>
                      <form action={resolveEscalationAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="action" value="dismiss" />
                        <button
                          type="submit"
                          className="text-[10px] px-2 py-1 bg-gray-400 text-white rounded"
                        >
                          ✗
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity feed */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">
            🤖 Atividade recente
          </h2>
          {recentLogs.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Nenhuma execução ainda. Rode{" "}
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                npm run team:simulate
              </code>
            </p>
          ) : (
            <ul className="space-y-2">
              {recentLogs.map((log) => (
                <li
                  key={log.id}
                  className="text-xs border-b border-gray-100 pb-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        log.success ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="font-medium text-gray-900">
                      {log.agentId}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600">{log.eventName}</span>
                    <span className="ml-auto text-gray-400">
                      R$ {log.costBrl.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-gray-500 ml-4 mt-0.5">
                    {log.durationMs}ms · {log.tokensIn + log.tokensOut} tokens
                    {log.escalated && (
                      <span className="text-amber-600 ml-1">⚠ escalated</span>
                    )}
                    {log.error && (
                      <span className="text-red-600 ml-1">
                        ✗ {log.error.slice(0, 60)}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
