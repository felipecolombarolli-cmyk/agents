/**
 * TenantConfig — estrutura gerada a partir da anamnese.
 *
 * Esta é a "fonte da verdade" sobre como cada tenant é customizado.
 * Tudo que muda por cliente é derivado daqui: módulos habilitados,
 * prompts do chatbot, templates de pesquisa, etc.
 */

import { z } from "zod";

// -------------------------------------------------------------
// Enums das respostas
// -------------------------------------------------------------

export const SECTORS = [
  "tech",
  "professional_services",
  "retail",
  "healthcare",
  "industry",
  "construction",
  "food_service",
  "education",
  "other",
] as const;
export type Sector = (typeof SECTORS)[number];

export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const HR_STRUCTURES = ["dedicated", "partial", "none"] as const;
export type HRStructure = (typeof HR_STRUCTURES)[number];

export const PAINS = [
  "communication",
  "turnover",
  "climate",
  "compliance_nr1",
  "attendance",
  "recognition",
  "labor_questions",
] as const;
export type Pain = (typeof PAINS)[number];

export const PUNCH_CLOCK_SYSTEMS = [
  "tangerino",
  "pontomais",
  "secullum",
  "ahgora",
  "other",
  "spreadsheet",
  "none",
] as const;
export type PunchClockSystem = (typeof PUNCH_CLOCK_SYSTEMS)[number];

export const SURVEY_FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly"] as const;
export type SurveyFrequency = (typeof SURVEY_FREQUENCIES)[number];

// -------------------------------------------------------------
// Schema Zod para validar respostas da anamnese
// -------------------------------------------------------------

export const AnamneseAnswersSchema = z.object({
  employeeCount: z.number().int().min(1).max(1000),
  sector: z.enum(SECTORS),
  workMode: z.array(z.enum(WORK_MODES)).min(1),
  hrStructure: z.enum(HR_STRUCTURES),
  pains: z.array(z.enum(PAINS)).min(1).max(3),
  punchClockSystem: z.enum(PUNCH_CLOCK_SYSTEMS),
  punchClockOther: z.string().optional(),
  values: z.array(z.string().min(1).max(30)).min(3).max(5),
  surveyFrequency: z.enum(SURVEY_FREQUENCIES),
  rewardInterest: z.enum(["symbolic", "pix_future"]),
  goal: z.string().min(10).max(280),
});

export type AnamneseAnswers = z.infer<typeof AnamneseAnswersSchema>;

// -------------------------------------------------------------
// TenantConfig completo (derivado)
// -------------------------------------------------------------

export interface TenantConfig {
  version: number;
  answers: AnamneseAnswers;
  derived: {
    enabledModules: {
      feed: boolean;
      profiles: boolean;
      chatbot: boolean;
      kudos: boolean;
      surveys: boolean;
      attendance: boolean;
      nr1Templates: boolean;
    };
    chatbotContext: {
      tone: "formal" | "casual";
      sectorLabel: string; // PT-BR
      cctReference: string;
      escalationTarget: "owner" | "hr_team";
    };
    surveyTemplates: string[];
    planTier: "STARTER" | "GROWTH" | "SCALE";
    orderedOnboardingModules: string[]; // ordem das telas baseada nas dores
  };
}

// -------------------------------------------------------------
// Derivação: respostas → config
// -------------------------------------------------------------

export function deriveConfig(answers: AnamneseAnswers): TenantConfig {
  return {
    version: 1,
    answers,
    derived: {
      enabledModules: {
        feed: true,
        profiles: true,
        chatbot: true,
        kudos: true,
        surveys: true,
        attendance: answers.punchClockSystem !== "none",
        nr1Templates: answers.pains.includes("compliance_nr1"),
      },
      chatbotContext: {
        tone: inferTone(answers.sector),
        sectorLabel: SECTOR_LABELS[answers.sector],
        cctReference: inferCCT(answers.sector),
        escalationTarget: answers.hrStructure === "none" ? "owner" : "hr_team",
      },
      surveyTemplates: buildSurveyTemplates(answers),
      planTier: inferPlanTier(answers.employeeCount),
      orderedOnboardingModules: orderModulesByPain(answers.pains),
    },
  };
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

const SECTOR_LABELS: Record<Sector, string> = {
  tech: "Tecnologia / Software",
  professional_services: "Serviços profissionais",
  retail: "Varejo / Comércio",
  healthcare: "Saúde / Clínicas",
  industry: "Indústria / Fábrica",
  construction: "Construção civil",
  food_service: "Alimentação / Restaurantes",
  education: "Educação",
  other: "Outros",
};

function inferTone(sector: Sector): "formal" | "casual" {
  const casualSectors: Sector[] = ["tech", "food_service"];
  return casualSectors.includes(sector) ? "casual" : "formal";
}

function inferCCT(sector: Sector): string {
  // Versão simplificada. Na fase 2, consulta base MTE.
  const ccts: Record<Sector, string> = {
    tech: "SINDPD (Sindicato dos Trabalhadores em Processamento de Dados)",
    professional_services: "CCT de serviços profissionais por estado",
    retail: "SECs/Sindicato do Comércio",
    healthcare: "Sindicato dos Trabalhadores em Saúde",
    industry: "CNI / Sindicatos industriais por categoria",
    construction: "SINTRACOMC / SINDUSCON",
    food_service: "Sindicato dos Hotéis e Bares",
    education: "SINPRO",
    other: "CCT a ser identificada",
  };
  return ccts[sector];
}

function buildSurveyTemplates(answers: AnamneseAnswers): string[] {
  const templates = ["enps_basic", "climate_pulse"];
  if (answers.pains.includes("compliance_nr1")) templates.push("nr1_psychosocial");
  if (answers.pains.includes("climate")) templates.push("climate_deep");
  if (answers.pains.includes("communication")) templates.push("communication_check");
  if (answers.pains.includes("recognition")) templates.push("recognition_feedback");
  return templates;
}

function inferPlanTier(count: number): "STARTER" | "GROWTH" | "SCALE" {
  if (count <= 30) return "STARTER";
  if (count <= 80) return "GROWTH";
  return "SCALE";
}

function orderModulesByPain(pains: Pain[]): string[] {
  // Ordena módulos no onboarding para mostrar primeiro o que resolve a dor principal
  const priority: Record<Pain, string> = {
    communication: "feed",
    recognition: "kudos",
    climate: "surveys",
    compliance_nr1: "surveys",
    attendance: "attendance",
    turnover: "surveys",
    labor_questions: "chatbot",
  };
  const ordered = pains.map((p) => priority[p]).filter(Boolean);
  // Adiciona o resto dos módulos ao final
  const all = ["feed", "kudos", "chatbot", "surveys", "attendance", "profiles"];
  return [...new Set([...ordered, ...all])];
}
