/**
 * /reconhecimento — Kudos entre pares
 *
 * - Form para enviar kudos (usa valores da empresa definidos na anamnese)
 * - Lista de kudos recebidos e enviados pelo usuário atual
 * - Ranking mensal de quem mais recebeu kudos
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { TenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

async function sendKudosAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const receiverId = String(formData.get("receiverId") ?? "");
  const value = String(formData.get("value") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (!receiverId || !value || !message) return;
  if (receiverId === session.user.id) return;
  if (message.length > 200) return;

  await prisma.kudos.create({
    data: {
      tenantId: session.tenant.id,
      senderId: session.user.id,
      receiverId,
      value,
      message,
    },
  });

  revalidatePath("/reconhecimento");
  revalidatePath("/feed");
}

export default async function ReconhecimentoPage() {
  const session = await requireSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenant.id },
  });
  const config = tenant?.config as unknown as TenantConfig | null;
  const values = config?.answers.values ?? ["Colaboração", "Excelência", "Respeito"];

  const [colleagues, received, sent, ranking] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: session.tenant.id, NOT: { id: session.user.id } },
      orderBy: { name: "asc" },
    }),
    prisma.kudos.findMany({
      where: { receiverId: session.user.id },
      include: { sender: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.kudos.findMany({
      where: { senderId: session.user.id },
      include: { receiver: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getMonthlyRanking(session.tenant.id),
  ]);

  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reconhecimento</h1>
        <p className="text-sm text-gray-500">
          Reconheça colegas que vivem os valores da {session.tenant.displayName}
        </p>
      </header>

      {/* Formulário */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">Enviar um kudos</h2>
        <form action={sendKudosAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Para quem?
            </label>
            <select
              name="receiverId"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Escolha um colega...</option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Qual valor essa pessoa demonstrou?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {values.map((v, i) => (
                <label
                  key={v}
                  className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-400 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="value"
                    value={v}
                    required
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">{v}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem <span className="text-gray-400">(até 200 caracteres)</span>
            </label>
            <textarea
              name="message"
              required
              maxLength={200}
              rows={3}
              placeholder="Ex: Obrigada pelo suporte na migração do sistema na semana passada!"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Enviar kudos 🏆
          </button>
        </form>
      </section>

      {/* Ranking + listas */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">🏅 Ranking do mês</h2>
          {ranking.length === 0 ? (
            <p className="text-gray-500 text-sm">Ainda sem kudos neste mês</p>
          ) : (
            <ol className="space-y-2">
              {ranking.map((r, i) => (
                <li key={r.userId} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 w-6">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{r.name}</p>
                  </div>
                  <span className="text-sm text-indigo-600 font-medium">
                    {r.count} {r.count === 1 ? "kudos" : "kudos"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            💌 Recebidos por você
          </h2>
          {received.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Nenhum kudos ainda. Em breve!
            </p>
          ) : (
            <ul className="space-y-3">
              {received.map((k) => (
                <li key={k.id} className="border-l-2 border-indigo-200 pl-3">
                  <p className="text-sm text-gray-800">"{k.message}"</p>
                  <p className="text-xs text-gray-500 mt-1">
                    — {k.sender.name} ·{" "}
                    <span className="text-indigo-600">{k.value}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Kudos enviados (compacto) */}
      {sent.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4">✨ Enviados por você</h2>
          <ul className="space-y-2">
            {sent.map((k) => (
              <li key={k.id} className="text-sm text-gray-700">
                Para <strong>{k.receiver.name}</strong> ·{" "}
                <span className="text-indigo-600">{k.value}</span> ·{" "}
                <span className="text-gray-500">"{k.message}"</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

async function getMonthlyRanking(tenantId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const rows = await prisma.kudos.groupBy({
    by: ["receiverId"],
    where: { tenantId, createdAt: { gte: startOfMonth } },
    _count: true,
    orderBy: { _count: { receiverId: "desc" } },
    take: 5,
  });

  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.receiverId) } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => ({
    userId: r.receiverId,
    name: byId.get(r.receiverId)?.name ?? "—",
    count: r._count,
  }));
}
