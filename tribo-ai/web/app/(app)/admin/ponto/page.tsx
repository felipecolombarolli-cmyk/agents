/**
 * /admin/ponto — Upload de arquivo de ponto
 *
 * Client component pra fazer upload via multipart e mostrar resultado.
 */

"use client";

import { useState } from "react";

type Result = {
  ok?: boolean;
  summary?: {
    source: string;
    totalRows: number;
    successRows: number;
    errorRows: number;
  };
  errors?: { row: number; message: string }[];
  preview?: unknown[];
  error?: string;
  message?: string;
};

export default function UploadPontoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("tangerino");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", format);

    try {
      const res = await fetch("/api/ponto/import", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as Result;
      setResult(json);
    } catch (err) {
      setResult({
        error: "network",
        message: err instanceof Error ? err.message : "erro",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Importar ponto</h1>
        <p className="text-sm text-gray-500">
          Envie um CSV ou XLSX exportado do seu sistema de ponto
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sistema de origem
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="tangerino">Tangerino</option>
            <option value="pontomais">Pontomais</option>
            <option value="secullum">Secullum</option>
            <option value="ahgora">Ahgora</option>
            <option value="generic">Outro (detecção automática)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arquivo (CSV ou XLSX)
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="w-full text-sm file:mr-3 file:px-4 file:py-2 file:border-0 file:bg-indigo-50 file:text-indigo-700 file:rounded-lg"
          />
          {file && (
            <p className="text-xs text-gray-500 mt-1">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Importando..." : "Importar"}
        </button>
      </form>

      {result && (
        <section className="mt-6">
          {result.ok && result.summary ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h2 className="font-semibold text-green-900">
                ✓ Importação concluída
              </h2>
              <dl className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div>
                  <dt className="text-green-700">Total</dt>
                  <dd className="font-semibold text-green-900">
                    {result.summary.totalRows}
                  </dd>
                </div>
                <div>
                  <dt className="text-green-700">Sucesso</dt>
                  <dd className="font-semibold text-green-900">
                    {result.summary.successRows}
                  </dd>
                </div>
                <div>
                  <dt className="text-green-700">Erros</dt>
                  <dd className="font-semibold text-green-900">
                    {result.summary.errorRows}
                  </dd>
                </div>
              </dl>

              {result.preview && result.preview.length > 0 && (
                <details className="mt-4">
                  <summary className="text-sm text-green-800 cursor-pointer">
                    Ver preview ({result.preview.length} primeiros)
                  </summary>
                  <pre className="text-xs bg-white rounded p-3 mt-2 overflow-x-auto">
                    {JSON.stringify(result.preview, null, 2)}
                  </pre>
                </details>
              )}

              {result.errors && result.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="text-sm text-amber-700 cursor-pointer">
                    Ver {result.errors.length} erros
                  </summary>
                  <ul className="text-xs mt-2 space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-amber-700">
                        Linha {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h2 className="font-semibold text-red-900">❌ Erro na importação</h2>
              <p className="text-sm text-red-700 mt-1">
                {result.message ?? result.error ?? "Erro desconhecido"}
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
