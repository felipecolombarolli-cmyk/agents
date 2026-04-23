/**
 * Tipos compartilhados da equipe de agentes.
 */

export type Crew =
  | "leadership"
  | "sales"
  | "customer_success"
  | "support"
  | "marketing"
  | "operations";

export type ToolName =
  | "read_db"
  | "write_db"
  | "send_email"
  | "send_whatsapp"
  | "web_search"
  | "web_fetch"
  | "enrich_cnpj"
  | "write_markdown"
  | "escalate_to_founder"
  | "create_ticket"
  | "import_csv";

/**
 * Eventos que podem disparar agentes.
 * Cada event name mapeia para zero ou mais agentes via `triggers`.
 */
export type EventName =
  // Vendas
  | "new_lead"
  | "lead_enriched"
  | "lead_qualified"
  | "lead_replied"
  | "demo_scheduled"
  | "proposal_requested"
  // Onboarding
  | "contract_signed"
  | "anamnese_completed"
  | "data_import_needed"
  | "onboarding_day_checkpoint"
  // Support
  | "ticket_created"
  | "bug_reported"
  // Marketing
  | "cron_daily"
  | "cron_weekly"
  | "content_needed"
  // Ops
  | "billing_cycle"
  | "invoice_overdue"
  | "metrics_report_due"
  | "infra_alert"
  | "churn_signal_detected"
  | "health_check_due";

export interface AgentEvent {
  name: EventName;
  payload: Record<string, unknown>;
  tenantId?: string;
  occurredAt: Date;
}

export interface EscalationLevel {
  priority: "P0" | "P1" | "P2" | "P3";
  reason: string;
}

export interface EscalationRule {
  when: (result: AgentResult, event: AgentEvent) => EscalationLevel | null;
}

export interface AgentDefinition {
  id: string; // "ana-sdr"
  name: string; // "Ana"
  role: string; // "SDR — Sales Dev Rep"
  crew: Crew;
  persona: string; // descrição curta
  mission: string; // 1-2 frases

  /** Model config */
  model: "sonnet" | "haiku" | "minimax" | "minimax-lightning";
  maxTokens: number;
  temperature: number;

  /** Prompt base do agente (mission, regras, tom) */
  systemPrompt: string;

  /** Ferramentas que o agente tem acesso */
  tools: ToolName[];

  /** Eventos que disparam esse agente */
  triggers: EventName[];

  /** Regras de escalation — se alguma bate, manda pro fundador */
  escalationRules?: EscalationRule[];

  /** Budget máximo por execução (em BRL) */
  maxCostBrl: number;

  /** Timeout em ms */
  timeoutMs: number;
}

export interface AgentResult {
  agentId: string;
  eventName: EventName;
  success: boolean;
  output: unknown; // o que o agente produziu
  toolCalls: ToolCallLog[];
  costBrl: number;
  tokensUsed: { input: number; output: number };
  durationMs: number;
  escalated?: EscalationLevel;
  error?: string;
}

export interface ToolCallLog {
  tool: ToolName;
  input: unknown;
  output: unknown;
  mocked: boolean;
}

export interface ToolContext {
  event: AgentEvent;
  agent: AgentDefinition;
  mockMode: boolean;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<{ output: unknown; mocked: boolean }>;
