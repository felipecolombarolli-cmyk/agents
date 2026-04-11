/**
 * /feed — Timeline social interna
 *
 * Skeleton do MVP. Renderiza posts, permite criar novo post,
 * curtir e comentar. Busca dados via server component.
 */

import { Suspense } from "react";

// Mock de dados — substituir por prisma.post.findMany no real
const MOCK_POSTS = [
  {
    id: "1",
    author: { name: "Marina Costa", role: "Head of People", avatarUrl: null },
    content:
      "Pessoal, semana que vem temos nossa pesquisa de clima mensal — peço que reservem 3 minutinhos para responder! 🙏",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    likes: 12,
    comments: 3,
    liked: false,
  },
  {
    id: "2",
    author: { name: "João Silva", role: "Dev Backend", avatarUrl: null },
    content:
      "Hoje finalizamos a migração do sistema legado. Agradeço a @Paula e @Bruno pelo suporte nas últimas duas semanas. Colaboração é tudo! 🚀",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    likes: 24,
    comments: 7,
    liked: true,
  },
];

export default function FeedPage() {
  return (
    <main className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Feed</h1>

      <CreatePostBox />

      <Suspense fallback={<div>Carregando...</div>}>
        <div className="space-y-4 mt-6">
          {MOCK_POSTS.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </Suspense>
    </main>
  );
}

function CreatePostBox() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <textarea
        placeholder="No que você está pensando?"
        rows={3}
        className="w-full resize-none border-0 focus:ring-0 text-gray-900 placeholder-gray-400"
      />
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <div className="flex gap-2">
          <button className="text-sm text-gray-500 hover:text-gray-700">📷 Imagem</button>
          <button className="text-sm text-gray-500 hover:text-gray-700">👥 Segmentar</button>
        </div>
        <button className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          Publicar
        </button>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: (typeof MOCK_POSTS)[number] }) {
  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5">
      <header className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
          {post.author.name.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-gray-900">{post.author.name}</p>
          <p className="text-xs text-gray-500">
            {post.author.role} · {formatRelative(post.createdAt)}
          </p>
        </div>
      </header>

      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>

      <footer className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-sm text-gray-600">
        <button className={`flex items-center gap-1 ${post.liked ? "text-indigo-600" : ""}`}>
          <span>♥</span> {post.likes}
        </button>
        <button className="flex items-center gap-1">
          <span>💬</span> {post.comments}
        </button>
        <button className="ml-auto text-xs text-gray-400">Reconhecer +</button>
      </footer>
    </article>
  );
}

function formatRelative(d: Date): string {
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}
