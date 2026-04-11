# Anamnese do Cliente — Fluxo de Customização

## Objetivo

Em ≤ 10 minutos, capturar as informações mínimas necessárias para customizar o tenant do cliente sem perder a base padrão.

**Princípio**: a base (código, IA, UX) é a mesma. O que muda por cliente são **flags, prompts, templates e branding** — tudo gerado a partir do JSON de respostas da anamnese.

## Fluxo UX

```
Cliente assina contrato
        │
        ▼
Recebe email/WhatsApp: "Vamos configurar sua Tribo em 5 minutos"
        │
        ▼
Clica → abre /onboarding
        │
        ▼
Tela 1: Boas-vindas + "Responder 10 perguntas rápidas"
        │
        ▼
Telas 2-11: Uma pergunta por tela (UX mobile-first)
        │
        ▼
Tela 12: Upload do logo + escolha de cores
        │
        ▼
Tela 13: Upload da planilha de colaboradores
        │
        ▼
Tela 14: "Seu workspace está pronto!" → redireciona para /feed
        │
        ▼
[background] Agentes recebem webhook e iniciam:
  - Setup do tenant com config
  - Envio de email de boas-vindas aos colaboradores
  - Agendamento da primeira pesquisa de pulso para D+7
```

## As 10 perguntas

### 1. Quantos colaboradores sua empresa tem?
- Tipo: número (15-150)
- Impacto: define plano, limites, pricing
- Se < 15: avisa "Nossa plataforma é otimizada para empresas a partir de 15 colaboradores, mas você pode continuar"
- Se > 150: avisa "Temos planos enterprise — vamos conectar com vendas"

### 2. Qual o setor principal da empresa?
- Tipo: select
- Opções:
  - Tecnologia / Software
  - Serviços profissionais (consultoria, jurídico, contábil)
  - Varejo / Comércio
  - Saúde / Clínicas
  - Indústria / Fábrica
  - Construção civil
  - Alimentação / Restaurantes
  - Educação
  - Outros
- Impacto:
  - Templates de pesquisa (benchmarks do setor)
  - Prompt do chatbot (CCT da categoria)
  - Tom da comunicação

### 3. Qual o regime de trabalho?
- Tipo: select múltiplo
- Opções: Presencial, Híbrido, 100% Remoto
- Impacto:
  - Ativa/desativa features de presença
  - Ajusta pesquisas (ex: "home office" só para remotos/híbridos)

### 4. Você tem RH estruturado ou o dono cuida de tudo?
- Tipo: select
- Opções:
  - Sim, tenho RH dedicado (1+ pessoas)
  - Parcial, tem alguém que cuida mas não é full-time
  - Não, eu (dono/sócio) cuido pessoalmente
- Impacto:
  - Nível de automação do chatbot (mais autônomo se sem RH)
  - Para onde escalations vão (dono vs. RH)

### 5. O que mais dói hoje na gestão de pessoas?
- Tipo: select múltiplo (marque 1-3)
- Opções:
  - Comunicação — informações não chegam a todos
  - Rotatividade — colaboradores saindo demais
  - Clima ruim — gente desmotivada
  - Compliance — medo de fiscalização NR-1, MTE, eSocial
  - Ponto / ausências — bagunça no controle
  - Reconhecimento — ninguém se sente valorizado
  - Dúvidas trabalhistas — RH sobrecarregado com CLT
- Impacto:
  - **Define a ordem dos módulos no onboarding** (mostra primeiro o que resolve a dor)
  - Configura alertas e relatórios focados nessas dores
  - Personaliza a primeira pesquisa de pulso

### 6. Usa sistema de ponto? Qual?
- Tipo: select
- Opções:
  - Tangerino
  - Pontomais
  - Secullum
  - Ahgora
  - Outro sistema (qual?)
  - Planilha Excel
  - Não uso
- Impacto:
  - Configura o parser correto
  - Mostra instruções de export específicas
  - Se "Não uso": mostra alerta sobre obrigação de controle de ponto para >20 funcionários (CLT art. 74)

### 7. Quais são os 3-5 valores da sua empresa?
- Tipo: chips (até 5 livres)
- Exemplos pré-preenchidos (opcional): Colaboração, Excelência, Inovação, Cliente no centro, Respeito
- Impacto:
  - Valores viram as categorias de reconhecimento (kudos)
  - Chatbot usa esses valores para dar tom cultural

### 8. Quer fazer pesquisas de clima com que frequência?
- Tipo: select
- Opções:
  - Semanal (pulso curto, 3 perguntas)
  - Quinzenal
  - Mensal (padrão recomendado)
  - Trimestral
- Impacto:
  - Agenda automática de pesquisas
  - Benchmarks do setor ajustam por frequência

### 9. Reconhecimento entre pares: só simbólico ou quer recompensa em $?
- Tipo: select
- Opções:
  - Só emblemas e reconhecimento público (MVP)
  - Quero converter em PIX no futuro (interesse — ativa feature na fase 2)
- Impacto:
  - No MVP só símbolico; o interesse registra lead para fase 2

### 10. Qual seu maior objetivo com a Tribo nos próximos 3 meses?
- Tipo: texto livre (até 280 caracteres)
- Exemplos: "Reduzir turnover em 20%", "Melhorar comunicação entre unidades", "Ter eNPS > 50"
- Impacto:
  - Fica salvo no `TenantConfig.goal`
  - Usado pelo agente de health-check para medir progresso
  - Referenciado pelo customer success agent nos follow-ups

## Upload de branding

- Logo (PNG/SVG, max 2MB)
- Cor primária (color picker, default `#6366f1`)
- Cor secundária (default `#f59e0b`)
- Nome de exibição do workspace (ex: "Acme Brasil")

## Upload de colaboradores

- Template de planilha pré-baixado (XLSX)
- Colunas obrigatórias: Nome, Email, Cargo, Área/Departamento
- Colunas opcionais: Data de admissão, Unidade/Filial, Gestor (email), Matrícula
- Validação:
  - Emails únicos
  - Detecta duplicatas
  - Avisa erros linha a linha
- Após upload: cada colaborador recebe email convite para criar conta

## Schema do TenantConfig gerado

```ts
interface TenantConfig {
  // Meta
  createdAt: Date;
  version: number;

  // Respostas da anamnese
  employeeCount: number;
  sector: Sector;
  workMode: ("onsite" | "hybrid" | "remote")[];
  hrStructure: "dedicated" | "partial" | "none";
  pains: Pain[];
  punchClockSystem: PunchClockSystem;
  values: string[]; // 3-5 valores
  surveyFrequency: "weekly" | "biweekly" | "monthly" | "quarterly";
  rewardInterest: "symbolic" | "pix_future";
  goal: string;

  // Derivados (calculados a partir das respostas)
  enabledModules: {
    feed: true;
    profiles: true;
    chatbot: true;
    kudos: true;
    surveys: true;
    attendance: boolean; // true se tem sistema de ponto
    nr1Templates: boolean; // true se "compliance" é dor
  };

  chatbotContext: {
    sector: string;
    cctReference: string; // link/id da CCT da categoria
    internalPolicies: string[]; // carregadas depois
    tone: "formal" | "casual"; // inferido do setor
  };

  surveyTemplates: string[]; // IDs dos templates habilitados

  // Branding
  branding: {
    logo: string; // URL
    primaryColor: string;
    secondaryColor: string;
    displayName: string;
  };

  // Escalation
  escalationTarget: {
    type: "owner" | "hr_team";
    emails: string[];
    whatsapp?: string;
  };
}
```

## Como a base se mantém

A anamnese **nunca** muda:
- Código-fonte do app
- Estrutura do banco
- Modelos de IA
- Integrações core

A anamnese **sempre** muda (por cliente):
- Flags de módulos habilitados
- Texto dos prompts (injeção de contexto)
- Templates ativos
- Visual (cores, logo)
- Para onde escalations são roteadas

Isso garante que 1 base de código serve N clientes com experiência customizada.

## Fluxo de atualização da anamnese

O cliente pode reeditar a anamnese em `/admin/configuracao` a qualquer momento. Mudanças disparam:
- Re-geração de prompts
- Migração de dados se necessário
- Log de auditoria (quem mudou o quê e quando)
