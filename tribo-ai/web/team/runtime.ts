/**
 * Runtime do time de agentes.
 *
 * - Registra agentes pelo id e por triggers (event → agents[])
 * - Executa cada agente via Claude com tool use em loop
 * - Avalia escalation rules
 * - Persiste resultado no AgentLog
 * - Verifica budget antes de executar
 * - Circuit breaker: pausa agente após 3 falhas seguidas
 */

import { claude, MODELS, calculateCostBrl } from "../lib/ai/client";
import { TOOL_HANDLERS, TOOL_SCHEMAS } from "./tools";
import { logAgentExecution } from "./logger";
import { canSpend, trackSpend } from "./budget";
import type {
  AgentDefinition,
  AgentEvent,
  AgentResult,
  EventName,
  ToolCallLog,
  ToolContext,
} from "./types";

const isMockMode = () =>
  process.env.MOCK_TOOLS === "1" || !process.env.ANTHROPIC_API_KEY;

// Circuit breaker: track consecutive failures per agent
const failureCount = new Map<string, number>();
const CIRCUIT_BREAKER_THRESHOLD = 3;

class Registry {
  private byId = new Map<string, AgentDefinition>();
  private byTrigger = new Map<EventName, string[]>();

  register(def: AgentDefinition) {
    if (this.byId.has(def.id)) return; // idempotent
    this.byId.set(def.id, def);
    for (const trigger of def.triggers) {
      const list = this.byTrigger.get(trigger) ?? [];
      list.push(def.id);
      this.byTrigger.set(trigger, list);
    }
  }

  get(id: string): AgentDefinition | undefined {
    return this.byId.get(id);
  }

  all(): AgentDefinition[] {
    return [...this.byId.values()];
  }

  forEvent(event: EventName): AgentDefinition[] {
    const ids = this.byTrigger.get(event) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((x): x is AgentDefinition => !!x);
  }
}

export const registry = new Registry();

export async function runAgent(
  agentId: string,
  event: AgentEvent,
): Promise<AgentResult> {
  const agent = registry.get(agentId);
  if (!agent) {
    return errorResult(agentId, event, `Agente não registrado: ${agentId}`);
  }

  // Circuit breaker
  const failures = failureCount.get(agentId) ?? 0;
  if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
    return errorResult(
      agentId,
      event,
      `Circuit breaker aberto: ${agentId} falhou ${failures}x seguidas. Reset manual necessário.`,
    );
  }

  // Budget check
  if (!canSpend(agent.crew)) {
    return errorResult(
      agentId,
      event,
      `Budget diário excedido para crew "${agent.crew}". Agente pausado.`,
    );
  }

  const startedAt = Date.now();
  const toolCalls: ToolCallLog[] = [];
  let success = false;
  let output: unknown = null;
  let errorMsg: string | undefined;
  let tokensIn = 0;
  let tokensOut = 0;

  const mockMode = isMockMode();
  const toolCtx: ToolContext = { event, agent, mockMode };

  try {
    if (mockMode) {
      output = await runMocked(agent, event, toolCalls, toolCtx);
      success = true;
    } else {
      const model = agent.model === "sonnet" ? MODELS.SONNET : MODELS.HAIKU;
      const toolSchemas = agent.tools.map((t) => TOOL_SCHEMAS[t]);

      const messages: { role: "user" | "assistant"; content: unknown }[] = [
        {
          role: "user",
          content: `Evento recebido: ${event.name}\n\nPayload:\n${JSON.stringify(event.payload, null, 2)}`,
        },
      ];

      let iteration = 0;
      while (iteration < 8) {
        iteration++;
        const response = await claude.messages.create({
          model,
          max_tokens: agent.maxTokens,
          temperature: agent.temperature,
          system: [
            {
              type: "text",
              text: agent.systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
          messages: messages as never,
        });

        tokensIn += response.usage.input_tokens;
        tokensOut += response.usage.output_tokens;

        const toolUseBlocks = response.content.filter(
          (b) => b.type === "tool_use",
        ) as Array<{
          type: "tool_use";
          id: string;
          name: string;
          input: Record<string, unknown>;
        }>;
        const textBlocks = response.content.filter(
          (b) => b.type === "text",
        ) as Array<{ type: "text"; text: string }>;

        if (toolUseBlocks.length === 0) {
          output = textBlocks.map((t) => t.text).join("\n");
          success = true;
          break;
        }

        messages.push({ role: "assistant", content: response.content });
        const toolResults: unknown[] = [];
        for (const block of toolUseBlocks) {
          const handler = TOOL_HANDLERS[block.name as keyof typeof TOOL_HANDLERS];
          if (!handler) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `tool desconhecida: ${block.name}`,
              is_error: true,
            });
            continue;
          }
          try {
            const { output: toolOutput, mocked } = await handler(block.input, toolCtx);
            toolCalls.push({
              tool: block.name as never,
              input: block.input,
              output: toolOutput,
              mocked,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(toolOutput),
            });
          } catch (err) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: err instanceof Error ? err.message : "erro",
              is_error: true,
            });
          }
        }
        messages.push({ role: "user", content: toolResults });

        if (response.stop_reason !== "tool_use") break;
      }
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "erro desconhecido";
    success = false;
  }

  const durationMs = Date.now() - startedAt;
  const costBrl = mockMode
    ? 0
    : calculateCostBrl(
        agent.model === "sonnet" ? MODELS.SONNET : MODELS.HAIKU,
        tokensIn,
        tokensOut,
      );

  // Track budget
  trackSpend(agent.crew, costBrl);

  // Update circuit breaker
  if (success) {
    failureCount.set(agentId, 0);
  } else {
    failureCount.set(agentId, (failureCount.get(agentId) ?? 0) + 1);
  }

  const result: AgentResult = {
    agentId: agent.id,
    eventName: event.name,
    success,
    output,
    toolCalls,
    costBrl,
    tokensUsed: { input: tokensIn, output: tokensOut },
    durationMs,
    error: errorMsg,
  };

  // Escalation rules
  if (success && agent.escalationRules) {
    for (const rule of agent.escalationRules) {
      const level = rule.when(result, event);
      if (level) {
        result.escalated = level;
        break;
      }
    }
  }

  // Log no banco (async, não bloqueia)
  logAgentExecution(agent, result).catch(() => {});

  return result;
}

export async function dispatch(event: AgentEvent): Promise<AgentResult[]> {
  const agents = registry.forEvent(event.name);
  if (agents.length === 0) {
    console.warn(`[team] Nenhum agente escuta: ${event.name}`);
    return [];
  }
  return Promise.all(agents.map((a) => runAgent(a.id, event)));
}

export function resetCircuitBreaker(agentId: string) {
  failureCount.set(agentId, 0);
}

// Mock runner
async function runMocked(
  agent: AgentDefinition,
  event: AgentEvent,
  toolCalls: ToolCallLog[],
  ctx: ToolContext,
): Promise<string> {
  for (const tool of agent.tools) {
    const handler = TOOL_HANDLERS[tool];
    const mockInput = fakeInputFor(tool, event);
    try {
      const { output, mocked } = await handler(mockInput, ctx);
      toolCalls.push({ tool, input: mockInput, output, mocked });
    } catch {
      // ignora
    }
  }
  return `[MOCK] ${agent.name} (${agent.role}) processou evento "${event.name}". Tools chamadas: ${agent.tools.join(", ")}.`;
}

function fakeInputFor(tool: string, event: AgentEvent): Record<string, unknown> {
  switch (tool) {
    case "read_db": return { query: "count_users" };
    case "write_db": return { action: "mark_tenant_at_risk", tenantId: "mock-tenant" };
    case "send_email": return { to: "lead@example.com", subject: `Mock: ${event.name}`, body: "Corpo mockado" };
    case "send_whatsapp": return { to: "+5511999999999", message: `Mock WA: ${event.name}` };
    case "web_search": return { query: `tribo ai ${event.name}` };
    case "web_fetch": return { url: "https://example.com" };
    case "enrich_cnpj": return { cnpj: "12345678000100" };
    case "write_markdown": return { filename: `mock-${Date.now()}.md`, content: "# Mock\n\nConteúdo mockado." };
    case "escalate_to_founder": return { title: `Mock ${event.name}`, summary: "Evento mockado", priority: "P3" };
    case "create_ticket": return { title: "Mock ticket", priority: "P2" };
    case "import_csv": return { format: "tangerino" };
    default: return {};
  }
}

function errorResult(agentId: string, event: AgentEvent, error: string): AgentResult {
  return {
    agentId,
    eventName: event.name,
    success: false,
    output: null,
    toolCalls: [],
    costBrl: 0,
    tokensUsed: { input: 0, output: 0 },
    durationMs: 0,
    error,
  };
}
