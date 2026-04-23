/**
 * Event Bus — dispara agentes automaticamente quando ações acontecem no produto.
 *
 * Uso em qualquer API route ou Server Action:
 *   import { emitEvent } from "@/team/event-bus";
 *   await emitEvent("ticket_created", { title: "...", tenantId: "..." });
 *
 * O dispatch roda async (fire-and-forget) para não bloquear a request.
 */

import type { AgentEvent, EventName } from "./types";

let dispatchFn: ((event: AgentEvent) => Promise<unknown[]>) | null = null;

export function setDispatcher(fn: (event: AgentEvent) => Promise<unknown[]>) {
  dispatchFn = fn;
}

export function emitEvent(
  name: EventName,
  payload: Record<string, unknown> = {},
  tenantId?: string,
) {
  if (!dispatchFn) {
    console.warn(`[event-bus] Dispatcher não inicializado. Evento "${name}" descartado.`);
    return;
  }

  const event: AgentEvent = {
    name,
    payload,
    tenantId,
    occurredAt: new Date(),
  };

  // Fire-and-forget — não bloqueia a request
  dispatchFn(event).catch((err) => {
    console.error(`[event-bus] Erro ao processar evento "${name}":`, err);
  });
}
