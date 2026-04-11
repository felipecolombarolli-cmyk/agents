/**
 * Ferramentas disponíveis para os agentes.
 *
 * Cada ferramenta tem uma implementação real e um mock.
 * Se `MOCK_TOOLS=1` (ou ANTHROPIC_API_KEY não existir), usa mock.
 */

import { prisma } from "../lib/db";
import type { ToolHandler, ToolName, ToolContext } from "./types";

const isMockMode = () =>
  process.env.MOCK_TOOLS === "1" || !process.env.ANTHROPIC_API_KEY;

// ─────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────

const readDb: ToolHandler = async (input) => {
  // Implementação segura: só permite queries pré-definidas
  const query = String(input.query ?? "");
  switch (query) {
    case "count_users":
      if (isMockMode()) return { output: { count: 42 }, mocked: true };
      return { output: { count: await prisma.user.count() }, mocked: false };
    case "active_tenants":
      if (isMockMode()) return { output: { count: 10 }, mocked: true };
      return {
        output: { count: await prisma.tenant.count({ where: { status: "ACTIVE" } }) },
        mocked: false,
      };
    case "list_at_risk":
      if (isMockMode())
        return { output: [{ tenant: "Acme", score: 23 }], mocked: true };
      const atRisk = await prisma.tenant.findMany({
        where: { status: "AT_RISK" },
        select: { id: true, displayName: true },
      });
      return { output: atRisk, mocked: false };
    default:
      return { output: { error: `query desconhecida: ${query}` }, mocked: true };
  }
};

const writeDb: ToolHandler = async (input, ctx) => {
  if (isMockMode() || ctx.mockMode) {
    return { output: { ok: true, wrote: input }, mocked: true };
  }
  const action = String(input.action ?? "");
  if (action === "mark_tenant_at_risk") {
    const tenantId = String(input.tenantId ?? "");
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "AT_RISK" },
    });
    return { output: { ok: true }, mocked: false };
  }
  return { output: { error: `action desconhecida: ${action}` }, mocked: false };
};

// ─────────────────────────────────────────────
// Comunicação externa (sempre mockada em dev)
// ─────────────────────────────────────────────

const sendEmail: ToolHandler = async (input) => {
  const { to, subject, body } = input as {
    to: string;
    subject: string;
    body: string;
  };
  if (!process.env.RESEND_API_KEY || isMockMode()) {
    return {
      output: {
        ok: true,
        mocked: true,
        preview: `[MOCK EMAIL] to=${to} subject="${subject}" body=${body.slice(0, 80)}...`,
      },
      mocked: true,
    };
  }
  // Real: integra com Resend aqui
  return { output: { ok: true, id: "real-email-id" }, mocked: false };
};

const sendWhatsapp: ToolHandler = async (input) => {
  const { to, message } = input as { to: string; message: string };
  return {
    output: {
      ok: true,
      mocked: true,
      preview: `[MOCK WA] to=${to} msg=${message.slice(0, 80)}...`,
    },
    mocked: true,
  };
};

const webSearch: ToolHandler = async (input) => {
  const query = String(input.query ?? "");
  return {
    output: {
      results: [
        {
          title: `Resultado mock para "${query}"`,
          url: "https://example.com",
          snippet: "Mock snippet — implementar em produção",
        },
      ],
    },
    mocked: true,
  };
};

const webFetch: ToolHandler = async (input) => {
  const url = String(input.url ?? "");
  return {
    output: { url, content: `[MOCK fetch de ${url}]`, status: 200 },
    mocked: true,
  };
};

const enrichCnpj: ToolHandler = async (input) => {
  const cnpj = String(input.cnpj ?? "");
  return {
    output: {
      cnpj,
      razaoSocial: `Empresa Mock ${cnpj.slice(-4)}`,
      capitalSocial: 100000,
      atividadePrincipal: "Desenvolvimento de software",
      funcionariosEstimados: 42,
      uf: "SP",
    },
    mocked: true,
  };
};

const writeMarkdown: ToolHandler = async (input) => {
  const { filename, content } = input as { filename: string; content: string };
  return {
    output: {
      ok: true,
      path: `content/blog/${filename}`,
      wordCount: content.split(/\s+/).length,
      mocked: true,
    },
    mocked: true,
  };
};

const escalateToFounder: ToolHandler = async (input, ctx) => {
  const { title, summary, priority = "P2", context } = input as {
    title: string;
    summary: string;
    priority?: "P0" | "P1" | "P2" | "P3";
    context?: unknown;
  };

  if (isMockMode() || ctx.mockMode) {
    return {
      output: {
        ok: true,
        mocked: true,
        would_escalate: { title, priority, summary },
      },
      mocked: true,
    };
  }

  // Persiste escalation no banco para aparecer no /admin/supervisor
  await prisma.escalation.create({
    data: {
      tenantId: ctx.event.tenantId ?? "unknown",
      source: `agent:${ctx.agent.id}`,
      priority: priority as "P0" | "P1" | "P2" | "P3",
      title,
      summary,
      context: context ? JSON.parse(JSON.stringify(context)) : undefined,
    },
  });
  return { output: { ok: true }, mocked: false };
};

const createTicket: ToolHandler = async (input) => {
  return { output: { ok: true, ticketId: "TKT-mock-001", ...input }, mocked: true };
};

const importCsv: ToolHandler = async (input) => {
  const format = String(input.format ?? "generic");
  return {
    output: {
      ok: true,
      format,
      rowsImported: 42,
      errors: 0,
      mocked: true,
    },
    mocked: true,
  };
};

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

export const TOOL_HANDLERS: Record<ToolName, ToolHandler> = {
  read_db: readDb,
  write_db: writeDb,
  send_email: sendEmail,
  send_whatsapp: sendWhatsapp,
  web_search: webSearch,
  web_fetch: webFetch,
  enrich_cnpj: enrichCnpj,
  write_markdown: writeMarkdown,
  escalate_to_founder: escalateToFounder,
  create_ticket: createTicket,
  import_csv: importCsv,
};

/** Schema de cada ferramenta para a Anthropic Tool Use API */
interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_SCHEMAS: Record<ToolName, ToolSchema> = {
  read_db: {
    name: "read_db",
    description:
      "Consulta no banco de dados. Queries pré-definidas: count_users, active_tenants, list_at_risk.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  write_db: {
    name: "write_db",
    description: "Mutação no banco. Actions: mark_tenant_at_risk.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string" },
        tenantId: { type: "string" },
      },
      required: ["action"],
    },
  },
  send_email: {
    name: "send_email",
    description: "Envia email via Resend. Em dev é mockado.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  send_whatsapp: {
    name: "send_whatsapp",
    description: "Envia WhatsApp. Em dev é mockado.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        message: { type: "string" },
      },
      required: ["to", "message"],
    },
  },
  web_search: {
    name: "web_search",
    description: "Busca na web. Mock em dev.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  web_fetch: {
    name: "web_fetch",
    description: "Busca conteúdo de uma URL. Mock em dev.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  enrich_cnpj: {
    name: "enrich_cnpj",
    description: "Consulta dados públicos de CNPJ via ReceitaWS. Mock em dev.",
    input_schema: {
      type: "object",
      properties: { cnpj: { type: "string" } },
      required: ["cnpj"],
    },
  },
  write_markdown: {
    name: "write_markdown",
    description: "Grava arquivo markdown em content/blog/.",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string" },
        content: { type: "string" },
      },
      required: ["filename", "content"],
    },
  },
  escalate_to_founder: {
    name: "escalate_to_founder",
    description: "Cria uma escalation para o fundador humano revisar.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        context: { type: "object" },
      },
      required: ["title", "summary"],
    },
  },
  create_ticket: {
    name: "create_ticket",
    description: "Cria ticket de suporte.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        priority: { type: "string" },
      },
      required: ["title"],
    },
  },
  import_csv: {
    name: "import_csv",
    description: "Importa CSV/XLSX de ponto no formato indicado.",
    input_schema: {
      type: "object",
      properties: {
        format: { type: "string" },
        filePath: { type: "string" },
      },
      required: ["format"],
    },
  },
};
