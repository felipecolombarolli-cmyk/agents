# Escopo do MVP — Tribo.ai Fase 1

## Filosofia

Máximo enxuto para validar:
1. Empresas de 15-150 colaboradores pagam por uma plataforma unificada?
2. O chatbot de RH com CLT resolve dúvidas reais?
3. O reconhecimento entre pares gera engajamento?
4. O modelo de operação 100% por agentes consegue atender os primeiros 10 clientes sem fundador virar atendente?

## Features do MVP (7 itens)

### 1. Anamnese e onboarding
- Fluxo de 10 perguntas ao criar conta
- Gera JSON de `TenantConfig` que ajusta tudo (módulos, prompts, templates)
- Importação inicial de colaboradores via CSV/XLSX
- Branding básico (logo + 2 cores)

**Critério de aceite**: cliente completa em ≤ 10 min e já tem workspace utilizável.

### 2. Feed social interno
- Posts de texto + imagem
- Curtidas e comentários
- Menções (@colaborador)
- Filtros: "Equipe", "Empresa inteira", "Unidade"
- Moderação simples (admin pode apagar)

**Critério de aceite**: >60% dos colaboradores postam ou reagem em uma semana típica.

### 3. Diretório de colaboradores
- Perfil: nome, cargo, área, bio curta, skills, foto
- Busca por nome/cargo/área
- Página pública do perfil acessível a toda empresa

**Critério de aceite**: novo colaborador consegue encontrar colega em < 30s.

### 4. Chatbot RH com conhecimento CLT
- Interface de chat estilo ChatGPT
- Contexto do tenant injetado (políticas internas, CCT da categoria, regras da empresa)
- Base de conhecimento CLT pré-carregada (férias, 13º, banco de horas, licenças, faltas, DSR)
- Escalation: botão "Falar com RH humano" registra a pergunta num ticket para o dono da empresa

**Critério de aceite**: chatbot resolve ≥70% das dúvidas trabalhistas sem escalation.

### 5. Reconhecimento entre pares (kudos)
- Botão "Reconhecer" em qualquer perfil
- Escolher um dos 5 valores da empresa (definidos na anamnese)
- Mensagem livre (até 200 caracteres)
- Kudos aparece no feed
- Perfil mostra kudos recebidos (contadores por valor)
- Ranking mensal por área/empresa

**Critério de aceite**: média de ≥1 kudos por colaborador/mês.

### 6. Pesquisa de pulso + análise IA
- Admin dispara pesquisa de 3-5 perguntas
- Colaborador recebe notificação, responde em <2 min
- Resultados agregados anônimos
- **Análise de sentimento IA** nos comentários abertos
- eNPS automático
- Template NR-1 pronto

**Critério de aceite**: ≥75% de taxa de resposta em pesquisas.

### 7. Importação de ponto (sem integração direta)
- Upload de arquivo CSV/XLSX exportado do sistema de ponto do cliente
- Parsers para formatos dos sistemas mais comuns:
  - Tangerino
  - Pontomais
  - Secullum
  - Ahgora
  - Genérico (colunas mapeáveis)
- Visualização: "Quem está ausente hoje", "Quem está de férias na semana"
- Alertas simples: colaborador com 3+ faltas no mês

**Critério de aceite**: admin importa planilha e vê dados corretos sem suporte.

### 8. Dashboard admin
- Métricas: usuários ativos, posts, kudos, respostas de pesquisa
- eNPS atual e histórico
- Health score do tenant (para agentes detectarem churn)
- Gestão de usuários (adicionar, remover, promover admin)

**Critério de aceite**: dono da empresa entende saúde da plataforma em 1 glance.

## O que NÃO está no MVP (fase 2+)

- Wellness tracking (passos, humor, hidratação)
- Resgate de kudos em PIX
- Catálogo de recompensas (iFood, Magalu)
- Gamificação com tokens/níveis
- App mobile nativo
- Integração direta com sistema de ponto (só import CSV)
- Integração TOTVS/Senior/LG
- OKRs e avaliação 360°
- Licença-maternidade e eSocial
- Stories / lives / quizzes
- Fórum / grupos privados
- Integração WhatsApp Business (usa email no MVP)
- Multi-idioma (só PT-BR)
- White label / subdomain per tenant

## Métricas de sucesso do MVP

| Métrica | Alvo em 90 dias |
|---|---|
| Clientes pagantes | 10 |
| MRR | R$ 8.000 |
| Taxa de churn mensal | < 10% |
| eNPS do produto | > 40 |
| Tickets escalados ao fundador | < 5/dia |
| Custo operacional (API + infra) | < R$ 2.000/mês |
| Horas de trabalho humano (fundador) | < 20h/semana |

## Stack do MVP

```
web/
├── package.json          # Next.js 15, Prisma, Claude SDK
├── prisma/schema.prisma  # Modelo de dados
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── cadastro/
│   ├── onboarding/       # Anamnese
│   ├── (app)/
│   │   ├── feed/
│   │   ├── perfis/
│   │   ├── assistente/   # Chatbot RH
│   │   ├── reconhecimento/
│   │   ├── pesquisas/
│   │   ├── ponto/
│   │   └── admin/
│   └── api/
│       ├── chat/         # Streaming Claude
│       ├── kudos/
│       ├── ponto/import/
│       └── webhooks/
└── lib/
    ├── ai/               # Cliente Claude + prompts
    ├── db/               # Prisma client
    ├── auth/             # NextAuth config
    └── parsers/          # CSV parsers de ponto
```
