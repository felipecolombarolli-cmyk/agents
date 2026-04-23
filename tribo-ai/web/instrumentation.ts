/**
 * Next.js instrumentation — roda uma vez no boot do servidor.
 *
 * Inicializa:
 * 1. Registra todos os agentes no runtime
 * 2. Conecta event bus ao dispatcher
 * 3. Inicia o scheduler (cron jobs)
 */

export async function register() {
  // Só roda no server (não no client/edge)
  if (typeof window !== "undefined") return;

  // Lazy imports para evitar problemas de bundling
  const { registerAllAgents } = await import("./team/employees/index");
  const { dispatch } = await import("./team/runtime");
  const { setDispatcher } = await import("./team/event-bus");
  const { startScheduler } = await import("./team/scheduler");

  // 1. Registra agentes
  registerAllAgents();
  console.log("[boot] 16 agentes registrados");

  // 2. Conecta event bus
  setDispatcher(dispatch);
  console.log("[boot] Event bus conectado ao dispatcher");

  // 3. Inicia scheduler
  startScheduler();
  console.log("[boot] Scheduler iniciado");
}
