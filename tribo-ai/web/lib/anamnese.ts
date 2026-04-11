/**
 * Anamnese — 10 perguntas que customizam o tenant.
 * Estrutura declarativa usada tanto pelo formulário web
 * quanto pelo agente conversacional.
 */

import type { AnamneseAnswers } from "./tenant-config";

export interface Question {
  id: keyof AnamneseAnswers;
  order: number;
  type: "number" | "select" | "multi-select" | "chips" | "textarea";
  title: string;
  helpText?: string;
  options?: { value: string; label: string; icon?: string }[];
  min?: number;
  max?: number;
  minSelections?: number;
  maxSelections?: number;
  placeholder?: string;
  required: boolean;
}

export const ANAMNESE_QUESTIONS: Question[] = [
  {
    id: "employeeCount",
    order: 1,
    type: "number",
    title: "Quantos colaboradores sua empresa tem hoje?",
    helpText: "A Tribo é otimizada para empresas de 15 a 150 colaboradores.",
    min: 1,
    max: 1000,
    placeholder: "Ex: 42",
    required: true,
  },
  {
    id: "sector",
    order: 2,
    type: "select",
    title: "Qual o setor principal da sua empresa?",
    options: [
      { value: "tech", label: "Tecnologia / Software", icon: "💻" },
      { value: "professional_services", label: "Serviços profissionais", icon: "💼" },
      { value: "retail", label: "Varejo / Comércio", icon: "🛒" },
      { value: "healthcare", label: "Saúde / Clínicas", icon: "🏥" },
      { value: "industry", label: "Indústria / Fábrica", icon: "🏭" },
      { value: "construction", label: "Construção civil", icon: "🏗️" },
      { value: "food_service", label: "Alimentação / Restaurantes", icon: "🍽️" },
      { value: "education", label: "Educação", icon: "📚" },
      { value: "other", label: "Outros", icon: "✨" },
    ],
    required: true,
  },
  {
    id: "workMode",
    order: 3,
    type: "multi-select",
    title: "Qual o regime de trabalho?",
    helpText: "Pode escolher mais de uma opção se a empresa tiver regimes mistos.",
    options: [
      { value: "onsite", label: "Presencial" },
      { value: "hybrid", label: "Híbrido" },
      { value: "remote", label: "100% Remoto" },
    ],
    minSelections: 1,
    required: true,
  },
  {
    id: "hrStructure",
    order: 4,
    type: "select",
    title: "Como funciona o RH da empresa?",
    options: [
      { value: "dedicated", label: "Temos RH dedicado (1+ pessoas em tempo integral)" },
      { value: "partial", label: "Alguém cuida do RH, mas não é full-time" },
      { value: "none", label: "Sou o dono e cuido pessoalmente" },
    ],
    required: true,
  },
  {
    id: "pains",
    order: 5,
    type: "multi-select",
    title: "O que mais incomoda hoje na gestão de pessoas?",
    helpText: "Marque de 1 a 3 opções — as mais urgentes.",
    options: [
      { value: "communication", label: "Comunicação — informações não chegam a todos", icon: "💬" },
      { value: "turnover", label: "Rotatividade — colaboradores saindo demais", icon: "🚪" },
      { value: "climate", label: "Clima ruim — gente desmotivada", icon: "😔" },
      { value: "compliance_nr1", label: "Compliance — medo de fiscalização NR-1/MTE", icon: "⚠️" },
      { value: "attendance", label: "Ponto / ausências — bagunça no controle", icon: "📋" },
      { value: "recognition", label: "Reconhecimento — ninguém se sente valorizado", icon: "🏆" },
      { value: "labor_questions", label: "Dúvidas trabalhistas — RH sobrecarregado com CLT", icon: "⚖️" },
    ],
    minSelections: 1,
    maxSelections: 3,
    required: true,
  },
  {
    id: "punchClockSystem",
    order: 6,
    type: "select",
    title: "Você usa algum sistema de ponto eletrônico?",
    helpText: "Para empresas com mais de 20 funcionários, o controle de ponto é obrigatório (CLT art. 74).",
    options: [
      { value: "tangerino", label: "Tangerino" },
      { value: "pontomais", label: "Pontomais" },
      { value: "secullum", label: "Secullum" },
      { value: "ahgora", label: "Ahgora" },
      { value: "other", label: "Outro sistema" },
      { value: "spreadsheet", label: "Planilha Excel / Google Sheets" },
      { value: "none", label: "Não uso controle de ponto" },
    ],
    required: true,
  },
  {
    id: "values",
    order: 7,
    type: "chips",
    title: "Quais são os valores da sua empresa?",
    helpText: "Escreva 3 a 5 valores. Eles serão usados no módulo de reconhecimento entre pares.",
    placeholder: "Ex: Colaboração",
    minSelections: 3,
    maxSelections: 5,
    required: true,
  },
  {
    id: "surveyFrequency",
    order: 8,
    type: "select",
    title: "Com que frequência você quer fazer pesquisas de clima?",
    helpText: "Recomendamos começar mensal e ajustar depois.",
    options: [
      { value: "weekly", label: "Semanal (pulso curto, 3 perguntas)" },
      { value: "biweekly", label: "Quinzenal" },
      { value: "monthly", label: "Mensal (recomendado)" },
      { value: "quarterly", label: "Trimestral" },
    ],
    required: true,
  },
  {
    id: "rewardInterest",
    order: 9,
    type: "select",
    title: "Sobre o reconhecimento entre pares:",
    helpText: "Você tem interesse em, no futuro, permitir que colaboradores convertam kudos em prêmios (PIX, vale)?",
    options: [
      { value: "symbolic", label: "Não, só emblemas e reconhecimento público" },
      { value: "pix_future", label: "Sim, quero converter em PIX no futuro" },
    ],
    required: true,
  },
  {
    id: "goal",
    order: 10,
    type: "textarea",
    title: "Qual seu maior objetivo com a Tribo nos próximos 3 meses?",
    helpText: "Seja específico. Exemplo: 'Reduzir turnover em 20%' ou 'Ter eNPS acima de 50'.",
    placeholder: "Meu objetivo é...",
    min: 10,
    max: 280,
    required: true,
  },
];

/**
 * Validates a single answer against its question definition.
 * Returns an error message if invalid, or null if valid.
 */
export function validateAnswer(
  questionId: keyof AnamneseAnswers,
  value: unknown,
): string | null {
  const q = ANAMNESE_QUESTIONS.find((x) => x.id === questionId);
  if (!q) return `Pergunta desconhecida: ${questionId}`;

  if (q.required && (value === null || value === undefined || value === "")) {
    return "Esta resposta é obrigatória";
  }

  if (q.type === "number") {
    const n = Number(value);
    if (isNaN(n)) return "Informe um número válido";
    if (q.min !== undefined && n < q.min) return `Mínimo: ${q.min}`;
    if (q.max !== undefined && n > q.max) return `Máximo: ${q.max}`;
  }

  if (q.type === "multi-select" || q.type === "chips") {
    if (!Array.isArray(value)) return "Formato inválido";
    if (q.minSelections && value.length < q.minSelections) {
      return `Escolha pelo menos ${q.minSelections}`;
    }
    if (q.maxSelections && value.length > q.maxSelections) {
      return `Escolha no máximo ${q.maxSelections}`;
    }
  }

  if (q.type === "textarea") {
    const s = String(value ?? "");
    if (q.min !== undefined && s.length < q.min) return `Mínimo: ${q.min} caracteres`;
    if (q.max !== undefined && s.length > q.max) return `Máximo: ${q.max} caracteres`;
  }

  return null;
}
