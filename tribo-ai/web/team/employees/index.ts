/**
 * Registry de todos os agentes da equipe Tribo.ai.
 *
 * Importe este arquivo para ter certeza que todos os agentes
 * foram registrados no runtime.
 */

import { registry } from "../runtime";
import { LEADERSHIP_AGENTS } from "./leadership";
import { SALES_AGENTS } from "./sales";
import { CUSTOMER_SUCCESS_AGENTS } from "./customer-success";
import { SUPPORT_AGENTS } from "./support";
import { MARKETING_AGENTS } from "./marketing";
import { OPERATIONS_AGENTS } from "./operations";

export const ALL_AGENTS = [
  ...LEADERSHIP_AGENTS,
  ...SALES_AGENTS,
  ...CUSTOMER_SUCCESS_AGENTS,
  ...SUPPORT_AGENTS,
  ...MARKETING_AGENTS,
  ...OPERATIONS_AGENTS,
];

let registered = false;

export function registerAllAgents() {
  if (registered) return;
  for (const agent of ALL_AGENTS) {
    registry.register(agent);
  }
  registered = true;
}

// Auto-registra ao importar
registerAllAgents();
