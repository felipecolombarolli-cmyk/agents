/**
 * POST /api/chat/stream
 *
 * Streaming do Assistente de RH via SSE.
 * Injeta contexto do tenant no system prompt.
 */

import { NextRequest } from "next/server";
import { claude, MODELS, calculateCostBrl } from "@/lib/ai/client";
import { buildRHAssistantPrompt } from "@/lib/ai/rh-assistant-prompt";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import type { TenantConfig } from "@/lib/tenant-config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return new Response(
      JSON.stringify({ error: "missing_message" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenant.id },
  });
  if (!tenant) {
    return new Response(
      JSON.stringify({ error: "tenant_not_found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const config = tenant.config as unknown as TenantConfig;
  const systemPrompt = buildRHAssistantPrompt(config, tenant.displayName);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = claude.messages.stream({
          model: MODELS.SONNET,
          max_tokens: 800, // limitado pra controlar custo
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: "user", content: message }],
        });

        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }

        const final = await response.finalMessage();
        const cost = calculateCostBrl(
          MODELS.SONNET,
          final.usage.input_tokens,
          final.usage.output_tokens,
        );

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              cost_brl: Number(cost.toFixed(4)),
              tokens: final.usage,
            })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "erro desconhecido";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
