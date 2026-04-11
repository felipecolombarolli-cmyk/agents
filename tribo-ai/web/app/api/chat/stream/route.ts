/**
 * POST /api/chat/stream
 *
 * Streaming do Assistente de RH via SSE.
 * Injeta contexto do tenant no system prompt e mantém
 * histórico da sessão.
 */

import { NextRequest } from "next/server";
import { claude, MODELS, calculateCostBrl } from "@/lib/ai/client";
import { buildRHAssistantPrompt } from "@/lib/ai/rh-assistant-prompt";
// import { prisma } from "@/lib/db";
// import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { sessionId, message } = await req.json();

  // TODO: pegar do session/auth real
  // const session = await auth();
  // const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  // const history = await prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });

  // MOCK para demonstração
  const tenant = {
    displayName: "Empresa Demo",
    config: {
      version: 1,
      answers: {
        employeeCount: 42,
        sector: "tech" as const,
        workMode: ["hybrid" as const],
        hrStructure: "partial" as const,
        pains: ["communication" as const],
        punchClockSystem: "tangerino" as const,
        values: ["Colaboração", "Inovação", "Respeito"],
        surveyFrequency: "monthly" as const,
        rewardInterest: "symbolic" as const,
        goal: "Melhorar comunicação",
      },
      derived: {
        enabledModules: {
          feed: true,
          profiles: true,
          chatbot: true,
          kudos: true,
          surveys: true,
          attendance: true,
          nr1Templates: false,
        },
        chatbotContext: {
          tone: "casual" as const,
          sectorLabel: "Tecnologia / Software",
          cctReference: "SINDPD",
          escalationTarget: "hr_team" as const,
        },
        surveyTemplates: ["enps_basic", "climate_pulse"],
        planTier: "GROWTH" as const,
        orderedOnboardingModules: ["feed", "chatbot"],
      },
    },
  };

  const systemPrompt = buildRHAssistantPrompt(tenant.config, tenant.displayName);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await claude.messages.stream({
          model: MODELS.SONNET,
          max_tokens: 1500,
          temperature: 0.3,
          system: systemPrompt,
          messages: [
            // TODO: prepend history
            { role: "user", content: message },
          ],
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
            `data: ${JSON.stringify({ done: true, cost_brl: cost, tokens: final.usage })}\n\n`,
          ),
        );
        controller.close();

        // TODO: persistir mensagem + custo na sessão
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err instanceof Error ? err.message : "erro" })}\n\n`,
          ),
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
