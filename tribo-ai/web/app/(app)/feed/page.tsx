/**
 * /feed — Timeline social interna (Server Component)
 *
 * Lê posts reais do banco. O formulário de criação usa Server Action.
 */

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createPostAction(formData: FormData) {
  "use server";
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  const session = await requireSession();
  await prisma.post.create({
    data: {
      tenantId: session.tenant.id,
      authorId: session.user.id,
      content,
      visibility: "COMPANY",
    },
  });
  revalidatePath("/feed");
}

async function toggleLikeAction(formData: FormData) {
  "use server";
  const postId = String(formData.get("postId"));
  const session = await requireSession();
  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({
      data: { postId, userId: session.user.id },
    });
  }
  revalidatePath("/feed");
}

export default async function FeedPage() {
  const session = await requireSession();

  const posts = await prisma.post.findMany({
    where: { tenantId: session.tenant.id, deletedAt: null },
    include: {
      author: true,
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: session.user.id }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="max-w-2xl mx-auto py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Feed</h1>
        <p className="text-sm text-gray-500">
          {session.tenant.displayName} · Logado como {session.user.name}
        </p>
      </header>

      <form
        action={createPostAction}
        className="bg-white border border-gray-200 rounded-xl p-4"
      >
        <textarea
          name="content"
          placeholder="No que você está pensando?"
          rows={3}
          required
          className="w-full resize-none border-0 focus:ring-0 text-gray-900 placeholder-gray-400 outline-none"
        />
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="submit"
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Publicar
          </button>
        </div>
      </form>

      <div className="space-y-4 mt-6">
        {posts.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            Nenhum post ainda. Seja o primeiro a publicar!
          </p>
        )}
        {posts.map((post) => {
          const isLiked = post.likes.length > 0;
          return (
            <article
              key={post.id}
              className="bg-white border border-gray-200 rounded-xl p-5"
            >
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
                <form action={toggleLikeAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    className={`flex items-center gap-1 ${
                      isLiked ? "text-indigo-600" : ""
                    }`}
                  >
                    <span>♥</span> {post._count.likes}
                  </button>
                </form>
                <span className="flex items-center gap-1">
                  💬 {post._count.comments}
                </span>
              </footer>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function formatRelative(d: Date): string {
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}
