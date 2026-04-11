/**
 * /admin — Dashboard administrativo do tenant
 *
 * Métricas de engajamento, saúde do tenant, lista de usuários.
 * Acesso restrito a admins.
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { TenantConfig } from "@/lib/tenant-config";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession();
  if (!session.user.isAdmin) redirect("/feed");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenant.id },
  });
  if (!tenant) redirect("/feed");

  const config = tenant.config as unknown as TenantConfig | null;

  const now = new Date();
  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  const [userCount, postCount, kudosCount, responseCount, eNPS, users] =
    await Promise.all([
      prisma.user.count({ where: { tenantId: session.tenant.id } }),
      prisma.post.count({
        where: {
          tenantId: session.tenant.id,
          createdAt: { gte: last30 },
          deletedAt: null,
        },
      }),
      prisma.kudos.count({
        where: { tenantId: session.tenant.id, createdAt: { gte: last30 } },
      }),
      prisma.surveyResponse.count({
        where: { tenantId: session.tenant.id, createdAt: { gte: last30 } },
      }),
      computeENPS(session.tenant.id),
      prisma.user.findMany({
        where: { tenantId: session.tenant.id },
        orderBy: [{ isOwner: "desc" }, { isAdmin: "desc" }, { name: "asc" }],
        take: 50,
      }),
    ]);

  const healthScore = computeHealthScore({
    userCount,
    postCount,
    kudosCount,
    responseCount,
  });

  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Administração</h1>
        <p className="text-sm text-gray-500">
          {tenant.displayName} · plano {tenant.planTier}
        </p>
      </header>

      {/* Health score */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Saúde do workspace</h2>
            <p className="text-sm text-gray-500 mt-1">
              Baseado em engajamento dos últimos 30 dias
            </p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold ${healthColor(healthScore)}`}>
              {healthScore}
            </p>
            <p className="text-xs text-gray-400">de 100</p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${healthBarColor(healthScore)}`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Colaboradores" value={userCount} />
        <KpiCard label="Posts (30d)" value={postCount} />
        <KpiCard label="Kudos (30d)" value={kudosCount} />
        <KpiCard label="eNPS" value={eNPS ?? "—"} />
      </div>

      {/* Configuração derivada da anamnese */}
      {config && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            Configuração atual (da anamnese)
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <DefItem label="Setor" value={config.derived.chatbotContext.sectorLabel} />
            <DefItem
              label="Porte"
              value={`${config.answers.employeeCount} colaboradores`}
            />
            <DefItem
              label="Modelo de trabalho"
              value={config.answers.workMode.join(", ")}
            />
            <DefItem label="RH" value={config.answers.hrStructure} />
            <DefItem
              label="Dores priorizadas"
              value={config.answers.pains.join(", ")}
            />
            <DefItem
              label="Sistema de ponto"
              value={config.answers.punchClockSystem}
            />
            <DefItem
              label="Valores da empresa"
              value={config.answers.values.join(" · ")}
            />
            <DefItem label="CCT" value={config.derived.chatbotContext.cctReference} />
          </dl>
          <p className="text-xs text-gray-500 mt-3">Meta: {config.answers.goal}</p>
        </section>
      )}

      {/* Ações rápidas */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Ações rápidas</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/ponto"
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ↑ Importar ponto
          </Link>
          <Link
            href="/pesquisas"
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            📊 Criar pesquisa
          </Link>
          <Link
            href="/onboarding"
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ⚙️ Refazer anamnese
          </Link>
        </div>
      </section>

      {/* Lista de usuários */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-3">
          Colaboradores ({userCount})
        </h2>
        <ul className="divide-y divide-gray-100">
          {users.map((u) => (
            <li key={u.id} className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium text-sm">
                {u.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{u.name}</p>
                <p className="text-xs text-gray-500">
                  {u.role} · {u.email}
                </p>
              </div>
              <div className="flex gap-1">
                {u.isOwner && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                    Owner
                  </span>
                )}
                {u.isAdmin && !u.isOwner && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                    Admin
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function DefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-900 mt-0.5 capitalize">{value}</dd>
    </div>
  );
}

async function computeENPS(tenantId: string): Promise<number | null> {
  const responses = await prisma.surveyResponse.findMany({
    where: {
      tenantId,
      survey: { templateId: "enps_basic" },
    },
    select: { answers: true },
  });
  if (responses.length === 0) return null;

  let promoters = 0;
  let detractors = 0;
  let total = 0;

  for (const r of responses) {
    const answers = r.answers as unknown as { questionId: string; value: unknown }[];
    const scoreAnswer = answers.find((a) => a.questionId === "score");
    const score = Number(scoreAnswer?.value);
    if (isNaN(score)) continue;
    total++;
    if (score >= 9) promoters++;
    else if (score <= 6) detractors++;
  }

  if (total === 0) return null;
  return Math.round((promoters / total - detractors / total) * 100);
}

function computeHealthScore(d: {
  userCount: number;
  postCount: number;
  kudosCount: number;
  responseCount: number;
}): number {
  if (d.userCount === 0) return 0;
  const postsPerUser = d.postCount / d.userCount;
  const kudosPerUser = d.kudosCount / d.userCount;
  const responsesPerUser = d.responseCount / d.userCount;

  // Score ponderado (máx 100)
  const postsScore = Math.min(postsPerUser * 30, 30); // meta: 1 post/user/mês
  const kudosScore = Math.min(kudosPerUser * 30, 30); // meta: 1 kudos/user/mês
  const surveyScore = Math.min(responsesPerUser * 40, 40); // meta: 1 resposta/user/mês

  return Math.round(postsScore + kudosScore + surveyScore);
}

function healthColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function healthBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}
