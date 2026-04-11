# Tribo.ai — Web (Next.js)

MVP da plataforma Tribo.ai. Next.js 15 + Prisma + Tailwind + Claude.

## Setup

```bash
cd web
npm install
cp .env.example .env  # preencha as variáveis
npm run db:push       # cria schema no Postgres
npm run dev
```

Abra http://localhost:3000.

## Estrutura

```
web/
├── app/
│   ├── onboarding/          # Fluxo de anamnese (10 perguntas)
│   ├── (app)/
│   │   ├── feed/            # Timeline social
│   │   ├── assistente/      # Chatbot de RH com streaming
│   │   ├── ponto/           # Dashboard de ausências
│   │   └── ...              # (reconhecimento, pesquisas, perfis)
│   └── api/
│       ├── anamnese/submit/ # Persiste respostas, deriva TenantConfig
│       ├── chat/stream/     # SSE do assistente de RH
│       └── ponto/import/    # Upload de CSV/XLSX de ponto
├── lib/
│   ├── ai/                  # Cliente Claude + prompts
│   ├── parsers/             # Parsers de sistemas de ponto brasileiros
│   ├── anamnese.ts          # Declaração das 10 perguntas
│   └── tenant-config.ts     # Schema Zod + derivação de config
└── prisma/
    └── schema.prisma        # Modelo de dados multi-tenant
```

## Estado do MVP

| Módulo | Status |
|---|---|
| Schema Prisma | ✅ Definido |
| Anamnese (form) | ✅ UI pronta |
| Anamnese (API) | 🟡 Validação + derivação prontas; falta persistir |
| Chatbot RH (UI) | ✅ Streaming funcional |
| Chatbot RH (API) | 🟡 Stream via Claude OK; falta histórico e RAG |
| Feed | 🟡 UI com mock |
| Ponto (parsers) | ✅ Tangerino, Pontomais, Secullum, Ahgora, Generic |
| Ponto (API) | 🟡 Parser OK; falta persistência |
| Ponto (dashboard) | 🟡 UI com mock |
| Auth | ❌ Pendente (NextAuth) |
| Admin dashboard | ❌ Pendente |
| Kudos / Reconhecimento | ❌ Pendente |
| Pesquisas / surveys | ❌ Pendente |

## Próximos passos imediatos

1. Configurar NextAuth (magic link via Resend)
2. Instanciar Prisma client em `lib/db.ts`
3. Conectar APIs aos modelos reais
4. Implementar RAG para políticas internas do tenant
5. Criar página de admin `/admin/ponto` para upload
6. Seed de dados para demo

## Decisões técnicas

- **App Router** (não Pages Router) — melhor streaming e server components
- **Server Actions** onde fizer sentido; APIs REST para webhooks e operações de IA
- **Prisma** em vez de Drizzle — DX mais madura para multi-tenant
- **Tailwind CSS v4** — menos config
- **Zod** em todas as fronteiras (API, DB, forms)
- **PostgreSQL** — pgvector para RAG, JSON para config flexível
