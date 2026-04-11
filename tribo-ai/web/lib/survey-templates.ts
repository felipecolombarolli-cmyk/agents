/**
 * Templates de pesquisa prontos.
 * Ativados automaticamente pela anamnese em `TenantConfig.derived.surveyTemplates`.
 */

export interface SurveyTemplate {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

export interface SurveyQuestion {
  id: string;
  type: "scale" | "boolean" | "text" | "single";
  text: string;
  options?: string[];
  required?: boolean;
}

export const SURVEY_TEMPLATES: Record<string, SurveyTemplate> = {
  enps_basic: {
    id: "enps_basic",
    title: "eNPS — Você nos recomendaria?",
    description:
      "Pesquisa curta que mede a chance de você recomendar a empresa como um bom lugar para trabalhar.",
    questions: [
      {
        id: "score",
        type: "scale",
        text: "Em uma escala de 0 a 10, quanto você recomendaria nossa empresa como um bom lugar para trabalhar?",
        required: true,
      },
      {
        id: "reason",
        type: "text",
        text: "Qual o principal motivo da sua nota?",
        required: false,
      },
    ],
  },

  climate_pulse: {
    id: "climate_pulse",
    title: "Pulso de clima",
    description: "3 perguntas rápidas sobre como você tem se sentido.",
    questions: [
      {
        id: "happy",
        type: "scale",
        text: "De 0 a 10, quão feliz você se sente trabalhando aqui nesta semana?",
        required: true,
      },
      {
        id: "support",
        type: "boolean",
        text: "Você se sentiu apoiado(a) pelo seu gestor nesta semana?",
        required: true,
      },
      {
        id: "blockers",
        type: "text",
        text: "Tem alguma coisa bloqueando seu trabalho hoje? (opcional)",
        required: false,
      },
    ],
  },

  nr1_psychosocial: {
    id: "nr1_psychosocial",
    title: "NR-1 — Avaliação de riscos psicossociais",
    description:
      "Pesquisa conforme a NR-1 (MTE) para identificar fatores de risco psicossocial no ambiente de trabalho.",
    questions: [
      {
        id: "workload",
        type: "scale",
        text: "Nos últimos 30 dias, minha carga de trabalho foi adequada",
        required: true,
      },
      {
        id: "autonomy",
        type: "scale",
        text: "Tenho autonomia suficiente para decidir como executar minhas tarefas",
        required: true,
      },
      {
        id: "support_manager",
        type: "scale",
        text: "Sinto que posso contar com apoio do meu gestor quando preciso",
        required: true,
      },
      {
        id: "psychological_safety",
        type: "scale",
        text: "Me sinto à vontade para dar opiniões sem medo de retaliação",
        required: true,
      },
      {
        id: "stress",
        type: "scale",
        text: "Nos últimos 30 dias, me senti exausto(a) ao final do dia com frequência",
        required: true,
      },
      {
        id: "open",
        type: "text",
        text: "Algo mais que o RH deveria saber? (confidencial)",
        required: false,
      },
    ],
  },

  climate_deep: {
    id: "climate_deep",
    title: "Clima organizacional — aprofundado",
    description: "Pesquisa mensal com 8 dimensões de clima.",
    questions: [
      {
        id: "leadership",
        type: "scale",
        text: "Confio nas decisões da liderança da empresa",
        required: true,
      },
      {
        id: "growth",
        type: "scale",
        text: "Vejo oportunidades de crescimento aqui",
        required: true,
      },
      {
        id: "recognition",
        type: "scale",
        text: "Sou reconhecido(a) pelo meu trabalho",
        required: true,
      },
      {
        id: "communication",
        type: "scale",
        text: "As informações importantes chegam até mim",
        required: true,
      },
    ],
  },

  communication_check: {
    id: "communication_check",
    title: "Check de comunicação interna",
    description: "Como está a comunicação entre times?",
    questions: [
      {
        id: "channel",
        type: "single",
        text: "Por onde você prefere receber comunicados da empresa?",
        options: ["Tribo (feed)", "Email", "WhatsApp", "Reunião presencial"],
        required: true,
      },
      {
        id: "clarity",
        type: "scale",
        text: "A comunicação interna tem sido clara",
        required: true,
      },
    ],
  },

  recognition_feedback: {
    id: "recognition_feedback",
    title: "Feedback sobre reconhecimento",
    description: "Você se sente reconhecido(a)?",
    questions: [
      {
        id: "frequency",
        type: "scale",
        text: "Recebo reconhecimento pelo meu trabalho com a frequência certa",
        required: true,
      },
      {
        id: "want_more",
        type: "text",
        text: "O que você gostaria de ver mais reconhecido?",
        required: false,
      },
    ],
  },
};

export function getTemplate(id: string): SurveyTemplate | undefined {
  return SURVEY_TEMPLATES[id];
}
