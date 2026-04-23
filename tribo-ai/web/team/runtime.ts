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

import OpenAI from "openai";
import { claude, MODELS, calculateCostBrl } from "../lib/ai/client";
import { minimax, MINIMAX_MODELS, calculateMiniMaxCostBrl } from "../lib/ai/minimax";
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

function isMockMode(agent: AgentDefinition): boolean {
  if (process.env.MOCK_TOOLS === "1") return true;
  const usesMinimax = agent.model === "minimax" || agent.model === "minimax-lightning";
  if (usesMinimax) return !process.env.MINIMAX_API_KEY;
  return !process.env.ANTHROPIC_API_KEY;
}

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

  const mockMode = isMockMode(agent);
  const toolCtx: ToolContext = { event, agent, mockMode };
  const usesMinimax = agent.model === "minimax" || agent.model === "minimax-lightning";

  try {
    if (mockMode) {
      output = await runMocked(agent, event, toolCalls, toolCtx);
      success = true;
    } else if (usesMinimax) {
      // MiniMax via OpenAI-compatible SDK
      const result = await runWithMiniMax(agent, event, toolCalls, toolCtx);
      output = result.output;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      success = true;
    } else {
      // Claude (Anthropic SDK)
      const result = await runWithClaude(agent, event, toolCalls, toolCtx);
      output = result.output;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      success = true;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "erro desconhecido";
    success = false;
  }

  const durationMs = Date.now() - startedAt;
  const costBrl = mockMode
    ? 0
    : usesMinimax
      ? calculateMiniMaxCostBrl(
          agent.model === "minimax-lightning"
            ? MINIMAX_MODELS.M25_LIGHTNING
            : MINIMAX_MODELS.M25,
          tokensIn,
          tokensOut,
        )
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

// ─────────────────────────────────────────────
// MiniMax executor (OpenAI-compatible SDK)
// ─────────────────────────────────────────────

async function runWithMiniMax(
  agent: AgentDefinition,
  event: AgentEvent,
  toolCalls: ToolCallLog[],
  ctx: ToolContext,
): Promise<{ output: unknown; tokensIn: number; tokensOut: number }> {
  const modelId = agent.model === "minimax-lightning"
    ? MINIMAX_MODELS.M25_LIGHTNING
    : MINIMAX_MODELS.M25;
  const toolSchemas = agent.tools.map((t) => TOOL_SCHEMAS[t]);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: agent.systemPrompt },
    {
      role: "user",
      content: `Evento recebido: ${event.name}\n\nPayload:\n${JSON.stringify(event.payload, null, 2)}`,
    },
  ];

  const tools: OpenAI.Chat.ChatCompletionTool[] = toolSchemas.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  let tIn = 0;
  let tOut = 0;
  let iteration = 0;

  while (iteration < 8) {
    iteration++;
    const response = await minimax.chat.completions.create({
      model: modelId,
      max_tokens: agent.maxTokens,
      temperature: agent.temperature,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    });

    const choice = response.choices[0];
    tIn += response.usage?.prompt_tokens ?? 0;
    tOut += response.usage?.completion_tokens ?? 0;

    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      return { output: choice.message.content ?? "", tokensIn: tIn, tokensOut: tOut };
    }

    messages.push(choice.message);

    for (const tc of choice.message.tool_calls) {
      if (tc.type !== "function") continue;
      const fnCall = tc as OpenAI.Chat.ChatCompletionMessageToolCall & { type: "function" };
      const handler = TOOL_HANDLERS[fnCall.function.name as keyof typeof TOOL_HANDLERS];
      let toolOutput: unknown;
      let mocked = false;

      if (!handler) {
        toolOutput = { error: `tool desconhecida: ${fnCall.function.name}` };
      } else {
        try {
          const args = JSON.parse(fnCall.function.arguments);
          const result = await handler(args, ctx);
          toolOutput = result.output;
          mocked = result.mocked;
          toolCalls.push({ tool: fnCall.function.name as never, input: args, output: toolOutput, mocked });
        } catch (err) {
          toolOutput = { error: err instanceof Error ? err.message : "erro" };
        }
      }

      messages.push({
        role: "tool" as const,
        tool_call_id: fnCall.id,
        content: JSON.stringify(toolOutput),
      });
    }

    if (choice.finish_reason !== "tool_calls") break;
  }

  return { output: messages[messages.length - 1], tokensIn: tIn, tokensOut: tOut };
}

// ─────────────────────────────────────────────
// Claude executor (Anthropic SDK)
// ─────────────────────────────────────────────

async function runWithClaude(
  agent: AgentDefinition,
  event: AgentEvent,
  toolCalls: ToolCallLog[],
  ctx: ToolContext,
): Promise<{ output: unknown; tokensIn: number; tokensOut: number }> {
  const model = agent.model === "sonnet" ? MODELS.SONNET : MODELS.HAIKU;
  const toolSchemas = agent.tools.map((t) => TOOL_SCHEMAS[t]);
  let tIn = 0;
  let tOut = 0;

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

    tIn += response.usage.input_tokens;
    tOut += response.usage.output_tokens;

    const toolUseBlocks = response.content.filter(
      (b) => b.type === "tool_use",
    ) as Array<{ type: "tool_use"; id: string; name: string; input: Record<string, unknown> }>;
    const textBlocks = response.content.filter(
      (b) => b.type === "text",
    ) as Array<{ type: "text"; text: string }>;

    if (toolUseBlocks.length === 0) {
      return { output: textBlocks.map((t) => t.text).join("\n"), tokensIn: tIn, tokensOut: tOut };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: unknown[] = [];
    for (const block of toolUseBlocks) {
      const handler = TOOL_HANDLERS[block.name as keyof typeof TOOL_HANDLERS];
      if (!handler) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `tool desconhecida: ${block.name}`, is_error: true });
        continue;
      }
      try {
        const { output: toolOutput, mocked } = await handler(block.input, ctx);
        toolCalls.push({ tool: block.name as never, input: block.input, output: toolOutput, mocked });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(toolOutput) });
      } catch (err) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: err instanceof Error ? err.message : "erro", is_error: true });
      }
    }
    messages.push({ role: "user", content: toolResults });

    if (response.stop_reason !== "tool_use") break;
  }

  return { output: null, tokensIn: tIn, tokensOut: tOut };
}

// ─────────────────────────────────────────────
// Mock runner
// ─────────────────────────────────────────────

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
