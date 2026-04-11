/**
 * POST /api/ponto/import
 *
 * Recebe arquivo de ponto (CSV/XLSX) exportado de um sistema brasileiro
 * e importa os registros de ausência/presença para o tenant.
 *
 * Body: multipart/form-data com:
 * - file: o arquivo
 * - format: "tangerino" | "pontomais" | "secullum" | "ahgora" | "generic"
 */

import { NextRequest, NextResponse } from "next/server";
import { parsePunchClockFile } from "@/lib/parsers/punch-clock";
// import { prisma } from "@/lib/db";
// import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Auth guard — descomentar em produção
  // const session = await auth();
  // if (!session?.user?.tenantId || !session.user.isAdmin) {
  //   return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // }

  const formData = await req.formData();
  const file = formData.get("file");
  const format = formData.get("format") as string;

  if (!(file instanceof File) || !format) {
    return NextResponse.json(
      { error: "missing_fields", message: "file e format são obrigatórios" },
      { status: 400 },
    );
  }

  const validFormats = ["tangerino", "pontomais", "secullum", "ahgora", "generic"];
  if (!validFormats.includes(format)) {
    return NextResponse.json(
      { error: "invalid_format", message: `format deve ser um de: ${validFormats.join(", ")}` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await parsePunchClockFile(
      buffer,
      format as Parameters<typeof parsePunchClockFile>[1],
      file.name,
    );

    // TODO: mapear employeeIdentifier → userId no banco
    // for (const rec of result.records) {
    //   const user = await findUserByIdentifier(session.user.tenantId, rec);
    //   if (!user) {
    //     result.errors.push({ row: -1, message: `Colaborador não encontrado: ${rec.employeeIdentifier}` });
    //     continue;
    //   }
    //   await prisma.attendance.upsert({
    //     where: { userId_date: { userId: user.id, date: rec.date } },
    //     create: { ...rec, userId: user.id, tenantId: session.user.tenantId },
    //     update: { type: rec.type, minutes: rec.minutesWorked, notes: rec.notes },
    //   });
    // }

    return NextResponse.json({
      ok: true,
      summary: {
        source: result.source,
        totalRows: result.totalRows,
        successRows: result.successRows,
        errorRows: result.errors.length,
      },
      errors: result.errors.slice(0, 20), // primeiros 20 erros
      preview: result.records.slice(0, 5), // preview de 5 registros
    });
  } catch (err) {
    return NextResponse.json(
      { error: "parse_failed", message: err instanceof Error ? err.message : "erro desconhecido" },
      { status: 422 },
    );
  }
}
