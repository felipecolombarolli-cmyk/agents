/**
 * CLI para testar a equipe de agentes.
 *
 * Uso:
 *   npx tsx team/cli.ts list
 *   npx tsx team/cli.ts show ana-sdr
 *   npx tsx team/cli.ts run ana-sdr new_lead '{"company":"DevHub","employeeCount":42}'
 *   npx tsx team/cli.ts dispatch new_lead '{"company":"DevHub"}'
 *   npx tsx team/cli.ts simulate-day
 *   npx tsx team/cli.ts inbox
 */

import "./employees"; // auto-registra
import { registry, runAgent, dispatch } from "./runtime";
import type { AgentEvent, EventName } from "./types";
import { prisma } from "../lib/db";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "list":
      return listAgents();
    case "show":
      return showAgent(args[0]);
    case "run":
      return runOne(args[0], args[1] as EventName, args[2]);
    case "dispatch":
      return dispatchEvent(args[0] as EventName, args[1]);
    case "simulate-day":
      return simulateDay();
    case "inbox":
      return showInbox();
    default:
      printUsage();
  }
}

function printUsage() {
  console.log(`${BOLD}Tribo.ai — CLI da equipe de agentes${RESET}

Comandos:
  ${GREEN}list${RESET}                               Lista todos os agentes por crew
  ${GREEN}show <agent-id>${RESET}                    Mostra detalhes de um agente
  ${GREEN}run <agent-id> <event> [payload]${RESET}   Executa um agente com um evento
  ${GREEN}dispatch <event> [payload]${RESET}         Dispatch de evento para todos os agentes que escutam
  ${GREEN}simulate-day${RESET}                       Simula um dia de trabalho (dispara eventos diversos)
  ${GREEN}inbox${RESET}                              Mostra escalations pendentes pro fundador

Exemplos:
  npx tsx team/cli.ts list
  npx tsx team/cli.ts run ana-sdr lead_qualified '{"company":"DevHub","employeeCount":42}'
  npx tsx team/cli.ts dispatch new_lead '{"company":"Acme","employeeCount":80}'
`);
}

function listAgents() {
  const agents = registry.all();
  const byCrew: Record<string, typeof agents> = {};
  for (const a of agents) {
    (byCrew[a.crew] ??= []).push(a);
  }

  console.log(`\n${BOLD}👥 Equipe Tribo.ai — ${agents.length} agentes${RESET}\n`);

  const crewOrder = [
    "leadership",
    "sales",
    "customer_success",
    "support",
    "marketing",
    "operations",
  ];
  const crewLabels: Record<string, string> = {
    leadership: "🧠 Liderança",
    sales: "💼 Vendas & Growth",
    customer_success: "🎯 Customer Success",
    support: "🎧 Suporte",
    marketing: "📣 Marketing",
    operations: "⚙️ Operações",
  };

  for (const crew of crewOrder) {
    const list = byCrew[crew] ?? [];
    if (list.length === 0) continue;
    console.log(`${BOLD}${crewLabels[crew] ?? crew}${RESET}`);
    for (const a of list) {
      console.log(`  ${BLUE}${a.id.padEnd(24)}${RESET} ${a.name.padEnd(10)} — ${DIM}${a.role}${RESET}`);
      console.log(`  ${DIM}  triggers: ${a.triggers.join(", ") || "—"}${RESET}`);
    }
    console.log();
  }
}

function showAgent(id: string) {
  if (!id) {
    console.error("Uso: show <agent-id>");
    return;
  }
  const a = registry.get(id);
  if (!a) {
    console.error(`${RED}Agente não encontrado: ${id}${RESET}`);
    return;
  }
  console.log(`\n${BOLD}${a.name} — ${a.role}${RESET}`);
  console.log(`${DIM}ID:${RESET} ${a.id}`);
  console.log(`${DIM}Crew:${RESET} ${a.crew}`);
  console.log(`${DIM}Model:${RESET} ${a.model} (${a.maxTokens} tokens, temp ${a.temperature})`);
  console.log(`${DIM}Persona:${RESET} ${a.persona}`);
  console.log(`${DIM}Missão:${RESET} ${a.mission}`);
  console.log(`${DIM}Tools:${RESET} ${a.tools.join(", ")}`);
  console.log(`${DIM}Triggers:${RESET} ${a.triggers.join(", ")}`);
  console.log(`${DIM}Budget/run:${RESET} R$ ${a.maxCostBrl.toFixed(2)}`);
  console.log(`${DIM}Escalations:${RESET} ${a.escalationRules?.length ?? 0} regras`);
  console.log();
}

async function runOne(agentId: string, eventName: EventName, payloadJson?: string) {
  if (!agentId || !eventName) {
    console.error("Uso: run <agent-id> <event-name> [payload-json]");
    return;
  }
  const payload = payloadJson ? JSON.parse(payloadJson) : {};
  const event: AgentEvent = {
    name: eventName,
    payload,
    occurredAt: new Date(),
  };

  console.log(`${BOLD}▶  Executando ${agentId}${RESET} com evento ${YELLOW}${eventName}${RESET}`);
  const start = Date.now();
  const result = await runAgent(agentId, event);
  const elapsed = Date.now() - start;

  const status = result.success
    ? `${GREEN}✓ success${RESET}`
    : `${RED}✗ failed${RESET}`;
  console.log(`\n${status} em ${elapsed}ms · custo R$ ${result.costBrl.toFixed(4)}`);
  console.log(`tokens: ${result.tokensUsed.input} in / ${result.tokensUsed.output} out`);
  console.log(`tool calls: ${result.toolCalls.length}`);
  for (const t of result.toolCalls) {
    const mark = t.mocked ? `${DIM}(mock)${RESET}` : "";
    console.log(`  ${BLUE}↳ ${t.tool}${RESET} ${mark}`);
  }
  if (result.escalated) {
    console.log(`\n${YELLOW}⚠  Escalated: ${result.escalated.priority}${RESET} — ${result.escalated.reason}`);
  }
  if (result.error) {
    console.log(`\n${RED}Erro: ${result.error}${RESET}`);
  }
  console.log(`\n${DIM}Output:${RESET}`);
  console.log(typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2));
}

async function dispatchEvent(eventName: EventName, payloadJson?: string) {
  if (!eventName) {
    console.error("Uso: dispatch <event-name> [payload-json]");
    return;
  }
  const payload = payloadJson ? JSON.parse(payloadJson) : {};
  const event: AgentEvent = {
    name: eventName,
    payload,
    occurredAt: new Date(),
  };

  console.log(`${BOLD}📨 Dispatch: ${YELLOW}${eventName}${RESET}`);
  const results = await dispatch(event);
  if (results.length === 0) {
    console.log(`${DIM}Nenhum agente escuta esse evento.${RESET}`);
    return;
  }
  console.log(`${results.length} agentes invocados:\n`);
  for (const r of results) {
    const status = r.success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(
      `  ${status} ${r.agentId.padEnd(20)} · ${r.toolCalls.length} tools · R$ ${r.costBrl.toFixed(4)}${r.escalated ? ` · ${YELLOW}escalated ${r.escalated.priority}${RESET}` : ""}`,
    );
  }
}

async function simulateDay() {
  console.log(`${BOLD}🌅 Simulando um dia de trabalho...${RESET}\n`);
  const events: AgentEvent[] = [
    {
      name: "new_lead",
      payload: { company: "DevHub Tech", cnpj: "12345678000100", employeeCount: 42 },
      occurredAt: new Date(),
    },
    {
      name: "lead_qualified",
      payload: { company: "DevHub Tech", contactEmail: "marina@devhub.com" },
      occurredAt: new Date(),
    },
    {
      name: "cron_daily",
      payload: {},
      occurredAt: new Date(),
    },
    {
      name: "ticket_created",
      payload: {
        title: "Não consigo fazer upload de planilha",
        sentiment: "neutral",
      },
      occurredAt: new Date(),
    },
    {
      name: "cron_weekly",
      payload: {},
      occurredAt: new Date(),
    },
  ];

  let totalCost = 0;
  let totalEscalations = 0;

  for (const event of events) {
    console.log(`${BOLD}→ Evento: ${event.name}${RESET}`);
    const results = await dispatch(event);
    for (const r of results) {
      totalCost += r.costBrl;
      if (r.escalated) totalEscalations++;
      const status = r.success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      console.log(`  ${status} ${r.agentId}`);
    }
    console.log();
  }

  console.log(`${BOLD}📊 Resumo do dia:${RESET}`);
  console.log(`  Custo total: ${GREEN}R$ ${totalCost.toFixed(4)}${RESET}`);
  console.log(`  Escalations geradas: ${totalEscalations}`);
}

async function showInbox() {
  const pending = await prisma.escalation.findMany({
    where: { status: "OPEN" },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 20,
  });
  if (pending.length === 0) {
    console.log(`${GREEN}📭 Inbox vazia — tudo sob controle${RESET}`);
    return;
  }
  console.log(`${BOLD}📬 Inbox do fundador — ${pending.length} escalations${RESET}\n`);
  for (const e of pending) {
    const priColor = e.priority === "P0" ? RED : e.priority === "P1" ? YELLOW : DIM;
    console.log(`${priColor}[${e.priority}]${RESET} ${BOLD}${e.title}${RESET}`);
    console.log(`  ${DIM}de ${e.source} · ${e.createdAt.toLocaleString("pt-BR")}${RESET}`);
    console.log(`  ${e.summary}\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
