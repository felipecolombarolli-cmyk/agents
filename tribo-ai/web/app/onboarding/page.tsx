/**
 * /onboarding — Fluxo de anamnese (10 perguntas)
 *
 * Nota: esta é a página-skeleton do MVP. Renderiza as perguntas
 * uma a uma e envia para /api/anamnese/submit ao final.
 */

"use client";

import { useState } from "react";
import { ANAMNESE_QUESTIONS, validateAnswer } from "@/lib/anamnese";
import type { AnamneseAnswers } from "@/lib/tenant-config";

type AnswersState = Partial<AnamneseAnswers>;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const questions = ANAMNESE_QUESTIONS;
  const current = questions[step];
  const isLast = step === questions.length - 1;
  const progress = ((step + 1) / questions.length) * 100;

  async function handleNext() {
    const value = answers[current.id];
    const validationError = validateAnswer(current.id, value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (isLast) {
      setSubmitting(true);
      try {
        const res = await fetch("/api/anamnese/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answers),
        });
        if (!res.ok) throw new Error("Falha ao enviar");
        window.location.href = "/onboarding/branding";
      } catch (err) {
        setError("Erro ao enviar. Tente novamente.");
        setSubmitting(false);
      }
    } else {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
    setError(null);
  }

  function updateAnswer(value: unknown) {
    setAnswers({ ...answers, [current.id]: value } as AnswersState);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>
              Pergunta {step + 1} de {questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {current.title}
          </h1>
          {current.helpText && (
            <p className="text-gray-600 mb-6">{current.helpText}</p>
          )}

          <div className="mt-6">
            <QuestionInput
              question={current}
              value={answers[current.id]}
              onChange={updateAnswer}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm mt-4" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="px-4 py-2 text-gray-600 disabled:opacity-40"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Enviando..." : isLast ? "Finalizar" : "Próxima →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// Input switcher baseado no tipo da pergunta
// -------------------------------------------------------------

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: (typeof ANAMNESE_QUESTIONS)[number];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "number") {
    return (
      <input
        type="number"
        min={question.min}
        max={question.max}
        placeholder={question.placeholder}
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
      />
    );
  }

  if (question.type === "select") {
    return (
      <div className="space-y-2">
        {question.options?.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${
              value === opt.value
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.icon && <span className="mr-3 text-xl">{opt.icon}</span>}
            <span className="text-gray-900">{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "multi-select") {
    const arr = (value as string[]) ?? [];
    const toggle = (val: string) => {
      if (arr.includes(val)) {
        onChange(arr.filter((x) => x !== val));
      } else {
        if (question.maxSelections && arr.length >= question.maxSelections) return;
        onChange([...arr, val]);
      }
    };
    return (
      <div className="space-y-2">
        {question.options?.map((opt) => {
          const selected = arr.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`w-full flex items-center p-4 border rounded-lg text-left transition ${
                selected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.icon && <span className="mr-3 text-xl">{opt.icon}</span>}
              <span className="text-gray-900 flex-1">{opt.label}</span>
              {selected && <span className="text-indigo-600">✓</span>}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "chips") {
    const arr = (value as string[]) ?? [];
    const [input, setInput] = useChipInput();
    const addChip = () => {
      const v = input.trim();
      if (!v) return;
      if (question.maxSelections && arr.length >= question.maxSelections) return;
      onChange([...arr, v]);
      setInput("");
    };
    return (
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          {arr.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full"
            >
              {chip}
              <button
                type="button"
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
                className="ml-2"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChip())}
            placeholder={question.placeholder}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
          />
          <button
            type="button"
            onClick={addChip}
            className="px-4 py-2 bg-gray-100 rounded-lg"
          >
            Adicionar
          </button>
        </div>
      </div>
    );
  }

  if (question.type === "textarea") {
    return (
      <textarea
        rows={4}
        maxLength={question.max}
        placeholder={question.placeholder}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
      />
    );
  }

  return null;
}

function useChipInput(): [string, (v: string) => void] {
  const [input, setInput] = useState("");
  return [input, setInput];
}
