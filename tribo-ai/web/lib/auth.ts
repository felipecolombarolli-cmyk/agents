/**
 * Auth para dev-mode.
 *
 * Lê qual usuário está "logado" a partir de um cookie `tribo_dev_user`.
 * Se o cookie não existir, cai no usuário demo padrão.
 *
 * Em produção, substituir por NextAuth + magic link via Resend.
 * A interface `DevSession` é propositalmente compatível com o shape
 * que o NextAuth vai expor.
 */

import { cookies } from "next/headers";
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

export const DEFAULT_DEMO_EMAIL = "demo@tribo.ai";
export const DEV_COOKIE_NAME = "tribo_dev_user";

export async function getSession(): Promise<DevSession | null> {
  const cookieStore = await cookies();
  const email = cookieStore.get(DEV_COOKIE_NAME)?.value ?? DEFAULT_DEMO_EMAIL;

  const user = await prisma.user.findFirst({
    where: { email },
    include: { tenant: true },
  });

  // Se cookie aponta pra usuário que não existe, cai no default
  if (!user && email !== DEFAULT_DEMO_EMAIL) {
    const fallback = await prisma.user.findFirst({
      where: { email: DEFAULT_DEMO_EMAIL },
      include: { tenant: true },
    });
    if (!fallback) return null;
    return serialize(fallback);
  }

  if (!user) return null;
  return serialize(user);
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

function serialize(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isOwner: boolean;
  tenant: { id: string; displayName: string };
}): DevSession {
  return {
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
}
