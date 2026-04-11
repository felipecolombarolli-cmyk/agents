# 👥 Equipe Tribo.ai — Nossos "funcionários" IA

A Tribo.ai é uma empresa **zero-employees** (exceto o fundador). Todo o trabalho operacional é feito por 16 agentes de IA especializados, organizados como um time de startup inicial.

Cada agente é um "funcionário" com:
- **Nome e persona** (para ser referenciado naturalmente)
- **Missão clara** (uma tarefa específica, não um cargo genérico)
- **Ferramentas** (o que pode fazer)
- **Triggers** (o que o acorda)
- **Escalation rules** (quando passa o bastão ao fundador humano)

## 📊 Org Chart

```
                           Felipe (fundador humano)
                                    │
                                    ▼
                           🧠 Mia — Chief Orchestrator
                                    │
       ┌────────────┬────────────┬──┴────────┬────────────┬─────────────┐
       ▼            ▼            ▼           ▼            ▼             ▼
    Vendas       Customer      Suporte    Marketing    Operações   (você)
                 Success                                          Escalations
```

## 🗂 Diretório da equipe

### Liderança (1)

| Agente | Papel | Missão |
|---|---|---|
| **🧠 Mia** | Chief Orchestrator | Recebe todos os eventos, decide qual agente invocar, gerencia escalations para o fundador |

### Vendas & Growth (4)

| Agente | Papel | Missão |
|---|---|---|
| **🔎 Bia** | Research Analyst | Enriquece leads com dados públicos (CNPJ, setor, porte) e calcula ICP score |
| **💌 Ana** | SDR — Sales Dev Rep | Qualifica leads e faz primeira abordagem personalizada por email/WhatsApp |
| **📞 Rafael** | Account Executive | Conduz demos, responde objeções, escreve propostas customizadas, fecha contratos |
| **⏰ Carla** | Sales Ops | Follow-up progressivo (D+2, D+5, D+10), nurturing, higiene de CRM |

### Customer Success (3)

| Agente | Papel | Missão |
|---|---|---|
| **🎓 Leo** | Customer Onboarder | Conduz anamnese conversacional, configura workspace, treinamento 5 dias |
| **📥 Diego** | Data Import Specialist | Importa CSV/XLSX de ponto + colaboradores, detecta formato, corrige erros |
| **💚 Sofia** | Customer Health Coach | Monitora uso diário, detecta sinais de churn, contata clientes em risco |

### Suporte (2)

| Agente | Papel | Missão |
|---|---|---|
| **🎧 Pedro** | Support Engineer | First responder de tickets, resolve dúvidas simples via base de conhecimento |
| **🐛 Lucas** | Bug Hunter | Reproduz bugs reportados, cria issues no GitHub, prioriza |

### Marketing (3)

| Agente | Papel | Missão |
|---|---|---|
| **✍️ Julia** | Content Writer | Escreve artigos de blog (1500-2500 palavras) sobre RH, CLT, NR-1, cultura |
| **🔍 Marcelo** | SEO Specialist | Pesquisa keywords BR, otimiza conteúdo, monitora rankings |
| **📮 Helena** | Email Marketer | Newsletter quinzenal, sequências de nurturing, campanhas sazonais |

### Operações (3)

| Agente | Papel | Missão |
|---|---|---|
| **💰 Thiago** | Finance Controller | Billing mensal, cobrança de inadimplentes (3 tentativas), categorização fiscal |
| **📊 Camila** | Data Analyst | Relatório semanal (MRR, churn, CAC, LTV, NPS, health scores agregados) |
| **🛡️ Fernando** | DevOps + Security | Monitora uptime, erros, performance, backups diários, scans de segurança |

## 🧱 Princípio fundamental

> **Lição KPMG/UvA**: agentes atribuídos a **cargos** (CFO, CMO) alucinam e desviam. Agentes atribuídos a **micro-tarefas** bem definidas funcionam.

Embora cada agente tenha uma "persona humana" pra facilitar referência, cada um executa **apenas uma tarefa** (ou um conjunto curto de tarefas correlatas). Nenhum agente é um "gerente genérico" que precisa improvisar.

## ⚙️ Como funcionam

1. **Um evento acontece** (novo lead, ticket aberto, cron dispara, etc.)
2. **Mia recebe** o evento (ou um webhook invoca direto o agente)
3. **Mia decide** qual agente é responsável (baseado em `triggers`)
4. O agente escolhido é **invocado** via Claude API com:
   - Seu system prompt (persona + missão)
   - As ferramentas que pode usar
   - O payload do evento
5. O agente pode **chamar ferramentas** (DB, email, web, etc.)
6. Se hit uma `escalation rule`, **envia para o fundador** (WhatsApp/email)
7. O resultado é **logado no banco** (audit trail)

## 🧰 Ferramentas disponíveis

| Tool | Agentes que usam | Descrição |
|---|---|---|
| `read_db` | Todos | Consulta leitura no Postgres via Prisma |
| `write_db` | Alguns | Mutação no Postgres |
| `send_email` | Ana, Carla, Helena, Leo, Thiago | Envia email (Resend) |
| `send_whatsapp` | Ana, Carla, Sofia, Thiago | Envia mensagem WhatsApp |
| `web_search` | Bia, Marcelo | Pesquisa na web |
| `web_fetch` | Bia | Busca página específica |
| `enrich_cnpj` | Bia | Consulta ReceitaWS |
| `write_markdown` | Julia | Cria arquivo markdown em blog/ |
| `escalate_to_founder` | Todos | Escala para fundador com contexto |
| `create_ticket` | Pedro | Cria ticket no sistema |
| `import_csv` | Diego | Importa CSV e mapeia colunas |

## 💰 Budget

Cada crew tem um budget diário em BRL. Se exceder, o Fernando alerta o fundador.

| Crew | Budget diário | Justificativa |
|---|---|---|
| Vendas | R$ 30 | Outreach volume, enriquecimento |
| Customer Success | R$ 20 | Onboarding calls, health checks |
| Suporte | R$ 15 | Tickets, RAG |
| Marketing | R$ 40 | Content generation é o mais caro |
| Operações | R$ 10 | Mais determinístico |
| **Total** | **R$ 115/dia = R$ 3.450/mês** | — |

Para 10 clientes pagando R$ 1.500/mês = **R$ 15.000 MRR**, custo operacional representa **23% do revenue**. Quanto mais clientes, menor o %.

## 🎮 Como rodar um agente manualmente

```bash
cd tribo-ai/web

# Listar toda a equipe
npm run team list

# Rodar um agente específico
npm run team run ana-sdr --event new_lead --payload '{"company":"DevHub","employees":42}'

# Simular um dia de trabalho (dispara crons)
npm run team simulate-day

# Ver inbox do fundador (escalations pendentes)
npm run team inbox
```

## 📁 Estrutura do código

```
web/team/
├── README.md                 # este arquivo
├── types.ts                  # tipos compartilhados (Agent, Event, Tool, etc.)
├── runtime.ts                # engine que executa agentes (Claude + tools)
├── tools.ts                  # implementações de ferramentas (mock + real)
├── escalation.ts             # sistema de escalation para o fundador
├── cli.ts                    # interface de linha de comando
└── employees/
    ├── index.ts              # registry de todos os 16
    ├── leadership.ts         # Mia (orchestrator)
    ├── sales.ts              # Bia, Ana, Rafael, Carla
    ├── customer-success.ts   # Leo, Diego, Sofia
    ├── support.ts            # Pedro, Lucas
    ├── marketing.ts          # Julia, Marcelo, Helena
    └── operations.ts         # Thiago, Camila, Fernando
```
