/**
 * POST /api/anamnese/submit
 *
 * Recebe as respostas da anamnese, valida, deriva o TenantConfig
 * e persiste no banco. No MVP assume que o usuário já está autenticado
 * e tem tenantId no session.
 */

import { NextRequest, NextResponse } from "next/server";
import { AnamneseAnswersSchema, deriveConfig } from "@/lib/tenant-config";
// import { prisma } from "@/lib/db";
// import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Auth guard — descomentar em produção
  // const session = await auth();
  // if (!session?.user?.tenantId) {
  //   return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // }

  const body = await req.json();
  const parsed = AnamneseAnswersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.format() },
      { status: 400 },
    );
  }

  const config = deriveConfig(parsed.data);

  // TODO: persistir no banco
  // await prisma.tenant.update({
  //   where: { id: session.user.tenantId },
  //   data: { config, status: "ACTIVE" },
  // });

  // TODO: disparar webhook para crew de onboarding
  // await triggerOnboardingCrew(session.user.tenantId, config);

  return NextResponse.json({
    ok: true,
    config,
    next: "/onboarding/branding",
  });
}
