/**
 * /ponto — Dashboard de ausências (Server Component)
 *
 * Lê ausências reais do banco.
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const typeLabels: Record<string, { label: string; color: string }> = {
  VACATION: { label: "Férias", color: "bg-blue-100 text-blue-800" },
  SICK_LEAVE: { label: "Atestado", color: "bg-amber-100 text-amber-800" },
  REMOTE: { label: "Home office", color: "bg-green-100 text-green-800" },
  MATERNITY: { label: "Lic. maternidade", color: "bg-pink-100 text-pink-800" },
  PATERNITY: { label: "Lic. paternidade", color: "bg-indigo-100 text-indigo-800" },
  ABSENT: { label: "Falta", color: "bg-red-100 text-red-800" },
  PRESENT: { label: "Presente", color: "bg-gray-100 text-gray-800" },
  HOLIDAY: { label: "Feriado", color: "bg-purple-100 text-purple-800" },
  PARTIAL: { label: "Parcial", color: "bg-yellow-100 text-yellow-800" },
  UNPAID_LEAVE: { label: "Licença", color: "bg-gray-100 text-gray-800" },
};

export default async function PontoPage() {
  const session = await requireSession();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const absencesToday = await prisma.attendance.findMany({
    where: {
      tenantId: session.tenant.id,
      date: { gte: todayStart, lte: todayEnd },
      type: { notIn: ["PRESENT"] },
    },
    include: { user: true },
    orderBy: { type: "asc" },
  });

  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ponto & Ausências</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quem está ausente hoje · {session.tenant.displayName}
          </p>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Hoje</h2>
        {absencesToday.length === 0 ? (
          <p className="text-gray-500">Ninguém ausente hoje 🎉</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {absencesToday.map((a) => {
              const t = typeLabels[a.type] ?? { label: a.type, color: "bg-gray-100" };
              return (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                      {a.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{a.user.name}</p>
                      <p className="text-xs text-gray-500">{a.user.role}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.color}`}>
                    {t.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-2">Importar de sistema de ponto</h2>
        <p className="text-gray-500 text-sm mb-4">
          Envie um CSV/XLSX exportado do Tangerino, Pontomais, Secullum, Ahgora ou formato genérico.
        </p>
        <p className="text-xs text-gray-400">
          (Fluxo de upload será adicionado em breve — por enquanto use POST /api/ponto/import)
        </p>
      </section>
    </main>
  );
}
