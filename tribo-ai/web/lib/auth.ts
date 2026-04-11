/**
 * Auth mock para modo de desenvolvimento.
 *
 * Em produção isto será substituído pelo NextAuth (magic link via Resend).
 * Para o MVP local, retorna sempre o tenant + usuário demo que foi criado
 * pelo script de seed.
 *
 * Uso:
 *   import { getSession } from "@/lib/auth";
 *   const session = await getSession();
 *   if (!session) return NextResponse.json({ error: "unauth" }, { status: 401 });
 */

import { prisma } from "./db";

export interface DevSession {
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    isAdmin: boolean;
    isOwner: boolean;
  };
  tenant: {
    id: string;
    displayName: string;
  };
}

const DEMO_USER_EMAIL = "demo@tribo.ai";

let cached: DevSession | null = null;

export async function getSession(): Promise<DevSession | null> {
  if (cached) return cached;

  const user = await prisma.user.findFirst({
    where: { email: DEMO_USER_EMAIL },
    include: { tenant: true },
  });

  if (!user) return null;

  cached = {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
    },
    tenant: {
      id: user.tenant.id,
      displayName: user.tenant.displayName,
    },
  };

  return cached;
}

export async function requireSession(): Promise<DevSession> {
  const s = await getSession();
  if (!s) {
    throw new Error(
      "Nenhum tenant demo encontrado. Rode: cd tribo-ai/web && npm run db:seed",
    );
  }
  return s;
}

export function clearSessionCache() {
  cached = null;
}
