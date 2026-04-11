import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tribo.ai",
  description: "Plataforma brasileira de engajamento e cultura",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="/feed" className="font-semibold text-indigo-600">
              Tribo.ai
            </a>
            <div className="flex gap-4 text-sm text-gray-600">
              <a href="/feed" className="hover:text-gray-900">Feed</a>
              <a href="/assistente" className="hover:text-gray-900">Assistente</a>
              <a href="/ponto" className="hover:text-gray-900">Ponto</a>
              <a href="/onboarding" className="hover:text-gray-900">Anamnese</a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
