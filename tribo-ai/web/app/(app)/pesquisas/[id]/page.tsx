/**
 * /pesquisas/[id] — Responder pesquisa
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import type { SurveyQuestion } from "@/lib/survey-templates";

export const dynamic = "force-dynamic";

async function submitAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const surveyId = String(formData.get("surveyId"));

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey || survey.tenantId !== session.tenant.id) return;

  const questions = survey.questions as unknown as SurveyQuestion[];
  const answers = questions.map((q) => ({
    questionId: q.id,
    value: formData.get(`q_${q.id}`) ?? null,
  }));

  // Análise de sentimento simples (mock) — na fase 2, chamar Claude Haiku aqui
  const textAnswers = answers
    .filter((a) => typeof a.value === "string" && (a.value as string).length > 10)
    .map((a) => a.value as string);
  const sentiment = textAnswers.length > 0 ? estimateSentiment(textAnswers.join(" ")) : null;

  await prisma.surveyResponse.create({
    data: {
      tenantId: session.tenant.id,
      surveyId,
      userId: survey.anonymous ? null : session.user.id,
      answers: answers as object,
      sentiment: sentiment?.score ?? null,
      sentimentLabel: sentiment?.label ?? null,
    },
  });

  redirect("/pesquisas?submitted=1");
}

function estimateSentiment(text: string): { score: number; label: string } {
  // Mock super simples — troque por chamada Haiku em produção
  const positive = /\b(bom|ótim|excelente|feliz|contente|apoiad|legal|adoro|amei)/i.test(text);
  const negative = /\b(ruim|péssim|triste|frustrad|exaust|cansad|insatisfeit|problema)/i.test(text);
  if (positive && !negative) return { score: 0.7, label: "positive" };
  if (negative && !positive) return { score: -0.6, label: "negative" };
  return { score: 0, label: "neutral" };
}

export default async function SurveyRespondPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey || survey.tenantId !== session.tenant.id) notFound();

  const already = await prisma.surveyResponse.findFirst({
    where: { surveyId: id, userId: session.user.id },
  });
  const alreadyAnswered = !!already;

  const questions = survey.questions as unknown as SurveyQuestion[];

  return (
    <main className="max-w-2xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{survey.title}</h1>
        {survey.description && (
          <p className="text-sm text-gray-600 mt-1">{survey.description}</p>
        )}
        {survey.anonymous && (
          <p className="text-xs text-indigo-600 mt-2">
            🔒 Suas respostas são anônimas
          </p>
        )}
      </header>

      {alreadyAnswered ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="font-medium text-green-900">
            ✓ Você já respondeu esta pesquisa
          </p>
          <a href="/pesquisas" className="text-sm text-green-700 underline mt-2 inline-block">
            Voltar
          </a>
        </div>
      ) : (
        <form
          action={submitAction}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-6"
        >
          <input type="hidden" name="surveyId" value={survey.id} />

          {questions.map((q, idx) => (
            <div key={q.id}>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {idx + 1}. {q.text}
                {q.required && <span className="text-red-500"> *</span>}
              </label>
              <QuestionInput q={q} />
            </div>
          ))}

          <button
            type="submit"
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Enviar resposta
          </button>
        </form>
      )}
    </main>
  );
}

function QuestionInput({ q }: { q: SurveyQuestion }) {
  if (q.type === "scale") {
    return (
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <label
            key={i}
            className="flex items-center justify-center border border-gray-200 rounded aspect-square text-sm font-medium cursor-pointer hover:border-indigo-400 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700"
          >
            <input
              type="radio"
              name={`q_${q.id}`}
              value={i}
              required={q.required}
              className="sr-only"
            />
            {i}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === "boolean") {
    return (
      <div className="flex gap-3">
        {["Sim", "Não"].map((v) => (
          <label
            key={v}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-center cursor-pointer hover:border-indigo-400 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50"
          >
            <input
              type="radio"
              name={`q_${q.id}`}
              value={v}
              required={q.required}
              className="sr-only"
            />
            {v}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === "single" && q.options) {
    return (
      <div className="space-y-2">
        {q.options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-400 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50"
          >
            <input
              type="radio"
              name={`q_${q.id}`}
              value={opt}
              required={q.required}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-900">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <textarea
      name={`q_${q.id}`}
      required={q.required}
      rows={3}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
      placeholder="Sua resposta..."
    />
  );
}
