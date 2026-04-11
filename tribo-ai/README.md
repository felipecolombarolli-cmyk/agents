# Tribo.ai

> Plataforma brasileira de engajamento, cultura e bem-estar para PMEs de 15-150 colaboradores, operada por um exército de agentes IA.

Inspirada no modelo do [triibe.club](https://www.triibe.club/), adaptada ao mercado brasileiro (CLT, NR-1, LGPD, PIX, WhatsApp, integração com sistemas de ponto nacionais) e operada 100% por agentes IA — zero funcionários humanos em fase inicial.

## Visão

Unificar em uma única plataforma o que hoje empresas brasileiras precisam contratar de 3 fornecedores diferentes:

- Comunicação interna (tipo Comunitive)
- Engajamento e clima (tipo TeamCulture)
- Bem-estar (tipo Wellhub)

Com um preço acessível para PMEs (R$ 25-40/colab/mês) e diferenciais únicos: chatbot de RH com conhecimento profundo de CLT/CCT, resgate de reconhecimento em PIX, e compliance NR-1 nativo.

## Público-alvo

- **15 a 150 colaboradores**
- Setores: tech, serviços, varejo, saúde, indústria leve
- Empresas sem RH estruturado ou com RH enxuto (1-3 pessoas)

## Estrutura do repositório

```
tribo-ai/
├── docs/                    # Documentação e especificações
│   ├── architecture.md      # Visão geral do sistema
│   ├── agents.md            # Arquitetura dos agentes operacionais
│   ├── anamnese.md          # Fluxo de onboarding do cliente
│   ├── mvp-scope.md         # Escopo do MVP (fase 1)
│   └── competitive.md       # Análise competitiva BR
├── agents/                  # Agentes que operam o negócio
│   ├── crews/               # Definição das equipes de agentes
│   └── prompts/             # Prompts de cada agente
└── web/                     # Aplicação Next.js (produto)
    ├── app/                 # Rotas Next.js 15 App Router
    ├── prisma/              # Schema do banco de dados
    └── lib/                 # Integrações (Claude, auth, etc)
```

## Start aqui

1. Leia [`docs/architecture.md`](./docs/architecture.md) para visão geral
2. Leia [`docs/mvp-scope.md`](./docs/mvp-scope.md) para o escopo da fase 1
3. Leia [`docs/agents.md`](./docs/agents.md) para entender o modelo de operação zero-funcionários
4. Leia [`docs/anamnese.md`](./docs/anamnese.md) para o fluxo de customização por cliente

## Status

🚧 Em planejamento e scaffolding inicial.
