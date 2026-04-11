/**
 * /pesquisas — Lista de pesquisas ativas e passadas
 *
 * - Usuário vê quais pesquisas precisa responder
 * - Admin pode criar nova pesquisa a partir de templates
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SURVEY_TEMPLATES, getTemplate } from "@/lib/survey-templates";
import type { TenantConfig } from "@/lib/tenant-config";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function createFromTemplateAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (!session.user.isAdmin) return;

  const templateId = String(formData.get("templateId") ?? "");
  const template = getTemplate(templateId);
  if (!template) return;

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + 7);

  await prisma.survey.create({
    data: {
      tenantId: session.tenant.id,
      title: template.title,
      description: template.description,
      templateId,
      questions: template.questions as object,
      status: "ACTIVE",
      startsAt: now,
      endsAt,
      anonymous: true,
    },
  });

  revalidatePath("/pesquisas");
}

export default async function PesquisasPage() {
  const session = await requireSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenant.id },
  });
  const config = tenant?.config as unknown as TenantConfig | null;
  const enabledTemplateIds = config?.derived.surveyTemplates ?? [];
  const availableTemplates = enabledTemplateIds
    .map((id) => SURVEY_TEMPLATES[id])
    .filter(Boolean);

  const activeSurveys = await prisma.survey.findMany({
    where: { tenantId: session.tenant.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const myResponses = await prisma.surveyResponse.findMany({
    where: { userId: session.user.id },
    select: { surveyId: true },
  });
  const answeredIds = new Set(myResponses.map((r) => r.surveyId));

  const pastSurveys = await prisma.survey.findMany({
    where: { tenantId: session.tenant.id, status: "CLOSED" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { responses: true } } },
  });

  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Pesquisas</h1>
        <p className="text-sm text-gray-500">
          Responda rápido · Suas respostas são anônimas
        </p>
      </header>

      {/* Pesquisas ativas */}
      <section className="mb-8">
        <h2 className="font-semibold text-gray-900 mb-3">🔴 Ativas</h2>
        {activeSurveys.length === 0 ? (
          <p className="text-gray-500 text-sm bg-white border border-gray-200 rounded-xl p-6">
            Nenhuma pesquisa ativa no momento.
            {session.user.isAdmin && " Crie uma a partir dos templates abaixo."}
          </p>
        ) : (
          <div className="space-y-3">
            {activeSurveys.map((s) => {
              const answered = answeredIds.has(s.id);
              return (
                <article
                  key={s.id}
                  className="bg-white border border-gray-200 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{s.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {(s.questions as unknown as unknown[]).length} perguntas ·
                        Encerra em{" "}
                        {s.endsAt
                          ? new Date(s.endsAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </p>
                    </div>
                    {answered ? (
                      <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full">
                        ✓ Respondida
                      </span>
                    ) : (
                      <Link
                        href={`/pesquisas/${s.id}`}
                        className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Responder
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Templates (admin) */}
      {session.user.isAdmin && availableTemplates.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-gray-900 mb-3">
            📋 Templates disponíveis
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Estes templates foram habilitados automaticamente com base na anamnese
            da sua empresa.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {availableTemplates.map((t) => (
              <form
                key={t.id}
                action={createFromTemplateAction}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <input type="hidden" name="templateId" value={t.id} />
                <h3 className="font-medium text-gray-900">{t.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{t.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {t.questions.length} perguntas
                </p>
                <button
                  type="submit"
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Criar pesquisa
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* Passadas */}
      {pastSurveys.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">📚 Encerradas</h2>
          <ul className="space-y-2">
            {pastSurveys.map((s) => (
              <li
                key={s.id}
                className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center"
              >
                <span className="text-sm text-gray-800">{s.title}</span>
                <span className="text-xs text-gray-500">
                  {s._count.responses} respostas
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
