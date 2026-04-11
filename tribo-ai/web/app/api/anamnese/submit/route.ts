/**
 * POST /api/anamnese/submit
 *
 * Recebe as respostas da anamnese, valida, deriva o TenantConfig
 * e persiste no banco.
 */

import { NextRequest, NextResponse } from "next/server";
import { AnamneseAnswersSchema, deriveConfig } from "@/lib/tenant-config";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return NextResponse.json(
      { error: "unauthorized", message: err instanceof Error ? err.message : "unauth" },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = AnamneseAnswersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.format() },
      { status: 400 },
    );
  }

  const config = deriveConfig(parsed.data);

  await prisma.tenant.update({
    where: { id: session.tenant.id },
    data: {
      config: config as object,
      status: "ACTIVE",
      planTier: config.derived.planTier,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: session.tenant.id,
      actorId: session.user.id,
      action: "update",
      entity: "Tenant",
      entityId: session.tenant.id,
      metadata: { action: "anamnese_submitted", planTier: config.derived.planTier },
    },
  });

  return NextResponse.json({
    ok: true,
    config,
    next: "/feed",
  });
}
