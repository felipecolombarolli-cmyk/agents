# Arquitetura de Agentes Operacionais

> **Princípio fundamental (lição KPMG/UvA):** não atribua agentes a cargos (CFO, CMO). Atribua agentes a **micro-tarefas bem definidas**. Muitos agentes pequenos > poucos agentes grandes.

## 5 Crews Operacionais

### Crew 1 — Vendas (do lead ao contrato)

**Objetivo:** transformar tráfego e leads em clientes pagantes sem intervenção humana.

**Triggers de entrada:**
- Formulário do site preenchido
- Lead vindo de anúncio (Meta/Google)
- Indicação de cliente existente
- Webhook de ferramentas externas (RD Station, HubSpot)

| # | Agente | Micro-tarefa | Ferramentas | Output |
|---|---|---|---|---|
| 1.1 | `lead-enricher` | Enriquece lead com dados (CNPJ, setor, n° funcionários, site) | ReceitaWS API, Apollo, web scrape | Lead com score 0-100 |
| 1.2 | `lead-qualifier` | Decide se é ICP (15-150 funcionários, Brasil, PME) | Regras + Claude | `qualified: true/false` |
| 1.3 | `outreach-writer` | Escreve primeira mensagem personalizada | Claude + template | Texto de email/WA |
| 1.4 | `outreach-sender` | Envia via email ou WhatsApp | Resend, WhatsApp API | `sent_at` |
| 1.5 | `follow-up-bot` | Agenda e envia follow-ups (D+2, D+5, D+10) | Cron + sender | Follow-ups enviados |
| 1.6 | `reply-classifier` | Classifica resposta: interessado, objeção, não | Claude | Categoria |
| 1.7 | `objection-handler` | Responde objeções comuns automaticamente | Claude + FAQ | Resposta |
| 1.8 | `demo-scheduler` | Agenda demonstração (Cal.com API) | Cal.com | Link de agenda |
| 1.9 | `proposal-writer` | Gera proposta comercial customizada | Claude + template | PDF de proposta |
| 1.10 | `contract-sender` | Envia contrato via Clicksign/DocuSign | Clicksign API | Contrato assinado |

**Escalation ao humano:**
- Lead de empresa >150 funcionários
- Objeção que o agente não sabe responder após 2 tentativas
- Pedido de negociação de preço além do desconto padrão
- Qualquer cliente pedindo "falar com alguém"

**KPIs:**
- Lead → Demo: meta 30%
- Demo → Cliente: meta 25%
- Custo de aquisição: meta < R$ 500/cliente
- Tempo lead → contrato: meta < 7 dias

---

### Crew 2 — Onboarding (do contrato ao cliente ativo)

**Objetivo:** cliente assinar hoje e estar usando ativamente em 7 dias, sem fundador atendendo.

**Triggers de entrada:**
- Contrato assinado (webhook Clicksign)
- Pagamento confirmado (webhook Stripe/Asaas)

| # | Agente | Micro-tarefa | Ferramentas | Output |
|---|---|---|---|---|
| 2.1 | `welcome-sender` | Envia mensagem de boas-vindas + link da anamnese | Email + WA | `sent_at` |
| 2.2 | `anamnese-conductor` | Conduz anamnese conversacional (se cliente preferir chat) | Claude | Respostas |
| 2.3 | `tenant-creator` | Cria tenant, aplica config, ativa módulos | DB, Prisma | `tenant_id` |
| 2.4 | `branding-applier` | Processa logo, aplica cores, gera theme | S3 + CSS | Theme pronto |
| 2.5 | `data-importer` | Importa CSV de colaboradores + ponto | Parser próprio | Users criados |
| 2.6 | `invite-sender` | Envia email de convite para cada colaborador | Resend | Convites enviados |
| 2.7 | `training-d1` | Envia "Dia 1: como postar no feed" | Email | Tutorial |
| 2.8 | `training-d3` | Envia "Dia 3: como reconhecer colegas" | Email | Tutorial |
| 2.9 | `training-d5` | Envia "Dia 5: use o chatbot de RH" | Email | Tutorial |
| 2.10 | `health-checker-d7` | Verifica se cliente usou nos primeiros 7 dias | DB query | Health score |
| 2.11 | `at-risk-rescuer` | Se health score baixo, envia check-in pessoal | Claude + WA | Mensagem |

**Escalation:**
- Cliente não responde convites em 48h → alerta fundador
- Erro de importação que não se resolve sozinho
- Health score = 0 após 5 dias → fundador liga

**KPIs:**
- Ativação em 7 dias: meta 80% dos clientes
- NPS de onboarding: meta > 50
- Tickets de suporte no primeiro mês: meta < 2 por cliente

---

### Crew 3 — Suporte (atendimento pós-venda)

**Objetivo:** resolver 95% dos tickets sem humano; o fundador só vê os 5% críticos.

**Triggers de entrada:**
- Ticket criado pelo cliente (dentro do app, email, WA)
- Bug reportado
- Solicitação de funcionalidade

| # | Agente | Micro-tarefa | Ferramentas | Output |
|---|---|---|---|---|
| 3.1 | `ticket-classifier` | Tipo (bug, dúvida, pedido), urgência (P0-P3) | Claude | Categoria + prioridade |
| 3.2 | `first-responder` | Responde dúvidas simples usando base de conhecimento | Claude + RAG | Resposta instantânea |
| 3.3 | `bug-reproducer` | Tenta reproduzir bug em ambiente de teste | Playwright | Log + screenshot |
| 3.4 | `bug-router` | Se bug confirmado, cria issue no GitHub e avisa fundador | GitHub API | Issue criada |
| 3.5 | `feature-request-logger` | Registra pedidos de feature em backlog | Notion/Linear API | Backlog atualizado |
| 3.6 | `escalation-agent` | Escala para fundador com contexto resumido | WhatsApp + email | Alerta |
| 3.7 | `satisfaction-agent` | Envia CSAT 15 min após fechar ticket | Email | NPS ticket |
| 3.8 | `knowledge-base-updater` | Se ticket frequente, atualiza base de conhecimento | Vector store | KB atualizada |

**Escalation:**
- Cliente irritado (classificador detecta tom negativo)
- Bug P0 (derruba o app)
- Ticket aberto há > 2h sem resolução
- Cliente pedindo cancelamento

**KPIs:**
- Taxa de resolução sem humano: meta > 90%
- Tempo médio de resposta: < 2 minutos
- CSAT: > 85%

---

### Crew 4 — Conteúdo e Marketing

**Objetivo:** gerar inbound orgânico contínuo (SEO, social, email) sem agência de marketing.

**Triggers de entrada:**
- Cron semanal (conteúdo programado)
- Evento regulatório (mudança na NR-1, novo CCT)
- Marco de cliente (case study maduro)

| # | Agente | Micro-tarefa | Ferramentas | Output |
|---|---|---|---|---|
| 4.1 | `keyword-researcher` | Pesquisa palavras-chave BR (SEMrush API) | SEMrush | Lista de keywords |
| 4.2 | `content-planner` | Monta calendário editorial semanal | Claude | Calendário |
| 4.3 | `blog-writer` | Escreve artigo completo (1500-2500 palavras) | Claude | Markdown |
| 4.4 | `blog-editor` | Revisa, melhora SEO, adiciona imagens | Claude + Unsplash | Markdown final |
| 4.5 | `blog-publisher` | Publica no site (Next.js + MDX) | Git commit | URL publicada |
| 4.6 | `social-snipper` | Corta artigo em 5-10 posts LinkedIn/Instagram | Claude | Posts prontos |
| 4.7 | `social-scheduler` | Agenda posts (Buffer API) | Buffer | Agendado |
| 4.8 | `newsletter-writer` | Escreve newsletter quinzenal | Claude | HTML |
| 4.9 | `newsletter-sender` | Envia para base de leads | Resend/Mailchimp | Enviado |
| 4.10 | `case-study-gen` | Gera case a partir de métricas reais de cliente | Claude + DB | Case study |

**Escalation:**
- Conteúdo sobre tema polêmico (agente detecta risco)
- Pedido de entrevista na mídia
- Menção negativa em redes (crise)

**KPIs:**
- Tráfego orgânico: +20% ao mês
- Leads inbound: 50% do total
- Custo por conteúdo: < R$ 30 (em API)

---

### Crew 5 — Operação e Financeiro

**Objetivo:** receber, reter, monitorar, otimizar.

**Triggers:**
- Cron diário, semanal, mensal
- Eventos (uso caindo, pagamento falhou, etc.)

| # | Agente | Micro-tarefa | Ferramentas | Output |
|---|---|---|---|---|
| 5.1 | `billing-agent` | Gera fatura mensal e envia | Stripe/Asaas | Fatura |
| 5.2 | `dunning-agent` | Cobra inadimplentes (3 tentativas progressivas) | Stripe | Pagamento ou cancelamento |
| 5.3 | `churn-detector` | Detecta sinais de churn (uso ↓, sem login 7d, NPS baixo) | DB + ML | Lista de riscos |
| 5.4 | `retention-agent` | Contata cliente em risco com oferta de ajuda | Claude + WA | Mensagem |
| 5.5 | `metrics-reporter` | Relatório semanal (MRR, churn, CAC, LTV, NPS) | DB | Dashboard |
| 5.6 | `infra-monitor` | Monitora uptime, erros, performance | Sentry, Vercel | Alertas |
| 5.7 | `cost-optimizer` | Analisa gastos (API Claude, infra) e sugere economias | Claude | Relatório |
| 5.8 | `tax-helper` | Categoriza transações para contabilidade | Claude | Planilha |
| 5.9 | `backup-agent` | Executa e valida backups diários | pgdump + S3 | Log |
| 5.10 | `security-scanner` | Roda scans de segurança, dependências vulneráveis | Snyk, Trivy | Relatório |

**Escalation:**
- Cliente cancelando (oportunidade de reverter)
- Inadimplência > R$ 2.000
- Incidente de segurança
- Custo operacional > R$ 2.000/mês (fora do orçamento)

**KPIs:**
- Churn mensal: < 5%
- Inadimplência: < 3%
- Uptime: > 99.5%
- Custo/cliente: < R$ 25/mês

---

## Padrões arquiteturais comuns

### Estrutura de cada agente

```typescript
interface Agent {
  id: string;                    // "lead-enricher"
  crew: Crew;                    // "sales"
  description: string;           // "Enriquece lead com dados públicos"
  model: "claude-sonnet-4-6";   // ou haiku para tarefas simples
  systemPrompt: string;          // prompt do agente
  tools: Tool[];                 // ferramentas que pode usar
  triggers: Trigger[];           // o que dispara o agente
  maxTokens: number;
  temperature: number;
  escalationRules: Rule[];       // quando escalar
  outputSchema: ZodSchema;       // formato estruturado de saída
}
```

### Orquestrador de Crew

Cada crew tem um **orquestrador leve** (agente coordenador) que:
1. Recebe o trigger
2. Decide qual agente(s) rodar
3. Encadeia outputs → inputs
4. Captura erros e decide se re-tenta ou escala
5. Loga tudo no audit trail

```typescript
class CrewOrchestrator {
  async handle(event: Event) {
    const plan = await this.planner(event);  // Claude decide o plano
    for (const step of plan.steps) {
      const result = await this.runAgent(step.agentId, step.input);
      if (result.escalate) return this.escalateToHuman(event, result);
      step.output = result;
    }
    return plan;
  }
}
```

### Escalation humana (fundador)

Dashboard próprio `/admin/supervisor` mostra:
- 📬 **Inbox** — ações pendentes do fundador
- 🚨 **Alertas** — P0s do dia
- 📊 **Métricas** — MRR, churn, NPS, custo
- 🤖 **Agentes** — status de cada crew

Notificações em tempo real:
- WhatsApp para urgentes (P0, P1)
- Email para diários (resumo)
- Slack para equipe futura

### Observabilidade

Cada execução de agente é logada com:
- `agent_id`
- `trigger_event`
- `input` (JSON)
- `output` (JSON)
- `tokens_used`
- `cost_usd`
- `duration_ms`
- `escalated` (bool)
- `error` (nullable)

Dashboards em Grafana mostram:
- Taxa de sucesso por agente
- Custo por crew por dia
- Latência p50/p95/p99
- Top 10 agentes mais caros

### Safety rails

- **Rate limiting** por agente (ex: max 100 execuções/hora)
- **Budget caps** por crew (ex: max R$ 50/dia em API)
- **Circuit breaker** — se agente falhar 5x seguidas, pausa e alerta
- **Human-in-the-loop mandatory** para: envio de contratos, alterações de preço, resposta a clientes irritados, qualquer coisa > R$ 1.000

## Stack de implementação

| Necessidade | Ferramenta |
|---|---|
| LLM | Claude API (`claude-sonnet-4-6` para maioria, `claude-haiku-4-5` para classificação) |
| Agent runtime | Claude Agent SDK + Managed Agents (recomendado) |
| Workflow | Temporal.io ou n8n |
| Queue | BullMQ (Redis) |
| Schedule | node-cron ou Temporal schedules |
| Vector store | pgvector (Postgres) |
| Observability | OpenTelemetry + Grafana Cloud |
| Alerting | PagerDuty lite ou telegram bot próprio |
