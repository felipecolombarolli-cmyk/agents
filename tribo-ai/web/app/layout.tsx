import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tribo.ai",
  description: "Plataforma brasileira de engajamento e cultura",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession().catch(() => null);

  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="/feed" className="font-semibold text-indigo-600">
              Tribo.ai
            </a>
            <div className="flex gap-4 text-sm text-gray-600 items-center">
              <a href="/feed" className="hover:text-gray-900">
                Feed
              </a>
              <a href="/reconhecimento" className="hover:text-gray-900">
                Kudos
              </a>
              <a href="/pesquisas" className="hover:text-gray-900">
                Pesquisas
              </a>
              <a href="/assistente" className="hover:text-gray-900">
                Assistente
              </a>
              <a href="/ponto" className="hover:text-gray-900">
                Ponto
              </a>
              {session?.user.isAdmin && (
                <a
                  href="/admin"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Admin
                </a>
              )}
              {session?.user.isOwner && (
                <a
                  href="/admin/ceo"
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  CEO
                </a>
              )}
              <span className="text-gray-300">|</span>
              {session ? (
                <a
                  href="/login"
                  className="text-xs text-gray-500 hover:text-gray-900"
                >
                  {session.user.name} ↻
                </a>
              ) : (
                <a href="/login" className="text-xs text-indigo-600">
                  Entrar
                </a>
              )}
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
