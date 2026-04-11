/**
 * /ponto — Dashboard de ausências importadas
 *
 * Mostra ausências do dia/semana + botão de importação.
 * O import propriamente dito fica em /admin/ponto.
 */

const MOCK_ABSENCES_TODAY = [
  { name: "Ana Carolina", type: "VACATION", until: "28/04" },
  { name: "Roberto Lima", type: "SICK_LEAVE", until: "12/04" },
  { name: "Paula Mendes", type: "REMOTE", until: null },
];

const typeLabels: Record<string, { label: string; color: string }> = {
  VACATION: { label: "Férias", color: "bg-blue-100 text-blue-800" },
  SICK_LEAVE: { label: "Atestado", color: "bg-amber-100 text-amber-800" },
  REMOTE: { label: "Home office", color: "bg-green-100 text-green-800" },
  MATERNITY: { label: "Lic. maternidade", color: "bg-pink-100 text-pink-800" },
  PATERNITY: { label: "Lic. paternidade", color: "bg-indigo-100 text-indigo-800" },
  ABSENT: { label: "Falta", color: "bg-red-100 text-red-800" },
};

export default function PontoPage() {
  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ponto & Ausências</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quem está ausente hoje e esta semana
          </p>
        </div>
        <a
          href="/admin/ponto"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          ↑ Importar arquivo
        </a>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Hoje</h2>
        {MOCK_ABSENCES_TODAY.length === 0 ? (
          <p className="text-gray-500">Ninguém ausente hoje 🎉</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {MOCK_ABSENCES_TODAY.map((a, i) => {
              const t = typeLabels[a.type] ?? { label: a.type, color: "bg-gray-100" };
              return (
                <li key={i} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                      {a.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{a.name}</p>
                      {a.until && (
                        <p className="text-xs text-gray-500">Até {a.until}</p>
                      )}
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
        <h2 className="font-semibold text-gray-900 mb-4">Esta semana</h2>
        <p className="text-gray-500 text-sm">
          Importe um arquivo de ponto para visualizar as ausências da semana.
        </p>
      </section>
    </main>
  );
}
