# Arquitetura — Tribo.ai

## 1. Visão geral

Tribo.ai é uma plataforma SaaS multi-tenant composta por dois sistemas distintos que se complementam:

```
┌─────────────────────────────────────────────────────────┐
│                      TRIBO.AI                           │
│                                                         │
│  ┌───────────────────────┐  ┌─────────────────────────┐ │
│  │  SISTEMA A: PRODUTO   │  │ SISTEMA B: OPERAÇÃO     │ │
│  │  (o SaaS em si)       │  │ (agentes que rodam o    │ │
│  │                       │  │  negócio)               │ │
│  │  - Web app Next.js    │  │ - Crews de agentes IA   │ │
│  │  - Multi-tenant       │  │ - Orquestração Claude   │ │
│  │  - Feed, chatbot,     │  │ - Triggers (cron, hooks)│ │
│  │    reconhecimento,    │  │ - WhatsApp, email       │ │
│  │    pesquisas          │  │ - Sem funcionários      │ │
│  │                       │  │   humanos               │ │
│  └───────────────────────┘  └─────────────────────────┘ │
│           ▲                            │                │
│           │                            │                │
│           └────── supervisão ──────────┘                │
│                                                         │
│                     ▲                                   │
│                     │                                   │
│              FUNDADOR (1 humano)                        │
│         aprova escalations, define estratégia           │
└─────────────────────────────────────────────────────────┘
```

## 2. Sistema A — O Produto (SaaS)

### 2.1. Stack técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | SSR, server actions, familiar |
| UI | Tailwind CSS + shadcn/ui | Rápido, acessível, mobile-first |
| Backend | Next.js API Routes / Server Actions | Monolito simples, baixa latência |
| DB | PostgreSQL + Prisma ORM | Multi-tenant, JSON para config flexível |
| Auth | NextAuth.js (email magic link + OAuth Google) | Sem senha = menos suporte |
| IA | Anthropic Claude API (`claude-sonnet-4-6`) | PT-BR forte, tool use nativo |
| Storage | Supabase Storage ou S3 | Arquivos, logos, atestados |
| Deploy | Vercel (web) + Neon/Supabase (db) | Zero devops |
| Observabilidade | Sentry + PostHog | Erros + analytics de uso |
| Pagamento | Stripe BR ou Asaas | Boleto, PIX, cartão recorrente |
| Mensageria | WhatsApp Business API (360dialog) | Canal #1 no Brasil |

### 2.2. Multi-tenancy

**Modelo: tenant-per-organization com isolamento por `tenant_id`.**

- Todas as tabelas principais têm FK para `tenant_id`
- Row-Level Security (RLS) no Postgres quando possível
- Subdomínio por cliente: `acme.tribo.ai` (fase 2)
- Dados compartilhados: benchmarks setoriais (anonimizados)

### 2.3. Módulos do produto (MVP)

| Módulo | Rota | Descrição |
|---|---|---|
| Feed | `/feed` | Timeline social interna |
| Perfis | `/perfis/[id]` | Diretório de colaboradores |
| Reconhecimento | `/reconhecimento` | Kudos, emblemas, histórico |
| Chatbot RH | `/assistente` | Chat com IA sobre CLT/políticas |
| Pesquisas | `/pesquisas` | Pulse surveys com análise IA |
| Ponto | `/ponto` | Visualização de ausências importadas |
| Admin | `/admin` | Dashboard, importação, config |
| Anamnese | `/onboarding` | Fluxo inicial do cliente |

### 2.4. Modelo de dados (alto nível)

```
Tenant ─┬─ User ─┬─ Post ── Like/Comment
        │        ├─ Kudos (sent/received)
        │        ├─ SurveyResponse
        │        └─ Attendance (importada do ponto)
        ├─ TenantConfig (anamnese)
        ├─ Survey ── SurveyQuestion
        ├─ Integration (ponto, PIX, etc)
        └─ AuditLog (LGPD)
```

Detalhe do schema: ver `web/prisma/schema.prisma`

## 3. Sistema B — Operação por Agentes

### 3.1. Princípio-chave (lição KPMG)

> Agentes atribuídos a **cargos** (CFO, CMO) alucinam e desviam.
> Agentes atribuídos a **micro-tarefas bem definidas** funcionam.
>
> Solução: **exército de agentes descartáveis**, cada um fazendo uma única coisa.

### 3.2. Arquitetura de Crews

5 crews operacionais, cada uma com 3-5 micro-agentes especializados:

1. **Crew de Vendas** — do lead ao contrato assinado
2. **Crew de Onboarding** — do contrato ao cliente ativo em 7 dias
3. **Crew de Suporte** — tickets, dúvidas, satisfação
4. **Crew de Conteúdo** — blog, social, email marketing, SEO
5. **Crew de Operação** — billing, churn, métricas, infra

Cada crew tem:
- Um **orquestrador** (Claude sonnet) que decide qual agente rodar
- **Micro-agentes** especializados (um prompt + uma ferramenta)
- **Triggers** (webhooks, cron, eventos do produto)
- **Escalation path** para o fundador humano

Detalhes: ver [`agents.md`](./agents.md)

### 3.3. Stack dos agentes

| Camada | Opção |
|---|---|
| LLM | Claude API (`claude-sonnet-4-6`) |
| Orquestração | Claude Agent SDK + Managed Agents (preferencial) ou CrewAI |
| Workflow engine | Temporal.io ou n8n self-hosted |
| Vector store | pgvector (Postgres) para base CLT/CCT |
| Queue | BullMQ + Redis |
| Monitoramento | OpenTelemetry + Grafana |
| Secrets | Doppler ou Vercel env vars |

### 3.4. Loop de supervisão humana

O fundador recebe no WhatsApp/Slack um resumo diário com:
- Escalations pendentes (tickets complexos, leads quentes, churns iminentes)
- Métricas do dia (MRR, novos clientes, NPS)
- Ações dos agentes que precisam aprovação (propostas >$X, alterações de contrato)
- Erros e alertas de agentes que falharam

Ferramenta: dashboard próprio `/admin/supervisor` + notificações push.

## 4. Fluxo ponta a ponta de um cliente

```
1. Lead chega (formulário site, anúncio, indicação)
         │
         ▼
2. Crew de Vendas: enriquece, contata por WhatsApp, agenda demo
         │
         ▼
3. Demo automatizada (vídeo gravado + Q&A com chatbot) OU call com fundador
         │
         ▼
4. Cliente aceita → Crew de Vendas envia proposta + contrato digital
         │
         ▼
5. Contrato assinado → Trigger: Crew de Onboarding
         │
         ▼
6. Agente de Anamnese conduz questionário (10 perguntas, ~5 min)
         │
         ▼
7. tenant-setup cria workspace, aplica config baseada nas respostas
         │
         ▼
8. data-importer recebe CSV de colaboradores + histórico de ponto
         │
         ▼
9. training-agent envia sequência de 5 dias de onboarding por WA
         │
         ▼
10. Cliente ativo → Crew de Suporte assume
         │
         ▼
11. health-checker monitora uso diário → detecta churn → escala
         │
         ▼
12. Crew de Operação: cobra mensalidade, renova, retém
```

## 5. Segurança e compliance

### LGPD
- Portal do titular em `/minha-conta/dados` (acesso, retificação, exclusão)
- Consentimento granular por finalidade
- Logs de acesso a dados sensíveis
- DPO virtual (agente IA) para responder solicitações de titulares
- Anonimização automática de ex-colaboradores após 5 anos

### Segurança
- Criptografia em trânsito (TLS 1.3) e em repouso (AES-256)
- Secrets nunca no código (Doppler)
- 2FA obrigatório para admins
- Rate limiting em todas as APIs
- Auditoria completa (`AuditLog` table)

### NR-1
- Pesquisas de riscos psicossociais com templates NR-1
- Relatórios de conformidade para auditoria MTE
- Alertas para gestores quando indicadores passam do threshold

## 6. Roadmap de evolução

| Fase | Escopo |
|---|---|
| **MVP (fase 1)** | Feed + perfis + chatbot RH + reconhecimento + pesquisas + ponto (import CSV) + admin |
| **Fase 2** | Wellness tracking, resgate PIX, gamificação completa, WhatsApp Business, integração TOTVS/Senior |
| **Fase 3** | OKRs, avaliação 360°, app mobile nativo (React Native), eSocial direto |
| **Fase 4** | Marketplace de benefícios, IA para predição de turnover, integração Gympass |
