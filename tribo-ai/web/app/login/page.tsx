/**
 * /login — Seletor de usuário em dev mode
 *
 * Mostra todos os usuários do tenant demo e permite "logar como".
 * Em produção vira magic link via Resend.
 */

import { prisma } from "@/lib/db";
import { DEV_COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function loginAsAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  if (!email) return;
  const cookieStore = await cookies();
  cookieStore.set(DEV_COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/feed");
}

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    include: { tenant: true },
    orderBy: { isOwner: "desc" },
  });

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Entrar no Tribo.ai</h1>
          <p className="text-gray-500 text-sm mt-1">
            Modo dev — escolha um usuário para logar como
          </p>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
            Em produção, aqui seria um formulário de magic link por email.
          </p>

          <div className="mt-6 space-y-2">
            {users.map((user) => (
              <form key={user.id} action={loginAsAction}>
                <input type="hidden" name="email" value={user.email} />
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">
                      {user.role} · {user.tenant.displayName}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {user.isOwner && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        Owner
                      </span>
                    )}
                    {user.isAdmin && !user.isOwner && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
