/**
 * Scheduler — cron jobs que disparam agentes automaticamente.
 *
 * Inicializado via instrumentation.ts no boot do Next.js.
 *
 * Schedule:
 * - cron_daily: 09:00 BRT (12:00 UTC) — Carla, Sofia, Thiago, Fernando
 * - cron_weekly: segunda 08:00 BRT (11:00 UTC) — Julia, Marcelo, Helena, Camila
 */

import cron from "node-cron";
import { emitEvent } from "./event-bus";

let initialized = false;

export function startScheduler() {
  if (initialized) return;
  initialized = true;

  console.log("[scheduler] Iniciando cron jobs...");

  // Diário às 09:00 BRT (12:00 UTC)
  cron.schedule("0 12 * * *", () => {
    console.log("[scheduler] cron_daily disparado");
    emitEvent("cron_daily", { source: "scheduler", scheduledAt: new Date().toISOString() });
  });

  // Semanal segunda 08:00 BRT (11:00 UTC)
  cron.schedule("0 11 * * 1", () => {
    console.log("[scheduler] cron_weekly disparado");
    emitEvent("cron_weekly", { source: "scheduler", scheduledAt: new Date().toISOString() });
  });

  // Health check diário 10:00 BRT (13:00 UTC)
  cron.schedule("0 13 * * *", () => {
    console.log("[scheduler] health_check_due disparado");
    emitEvent("health_check_due", { source: "scheduler" });
  });

  // Billing cycle dia 1 de cada mês 08:00 BRT
  cron.schedule("0 11 1 * *", () => {
    console.log("[scheduler] billing_cycle disparado");
    emitEvent("billing_cycle", { source: "scheduler" });
  });

  // Métricas report segunda 09:00 BRT
  cron.schedule("0 12 * * 1", () => {
    console.log("[scheduler] metrics_report_due disparado");
    emitEvent("metrics_report_due", { source: "scheduler" });
  });

  console.log("[scheduler] 5 cron jobs agendados:");
  console.log("  - cron_daily:         09:00 BRT (seg-dom)");
  console.log("  - cron_weekly:        08:00 BRT (segunda)");
  console.log("  - health_check_due:   10:00 BRT (seg-dom)");
  console.log("  - billing_cycle:      08:00 BRT (dia 1)");
  console.log("  - metrics_report_due: 09:00 BRT (segunda)");
}

export function stopScheduler() {
  cron.getTasks().forEach((task) => task.stop());
  initialized = false;
}
