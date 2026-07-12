"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type { AiJobStatusView, SuggestResult } from "@/lib/types";
import { registerSuggestionMealAction } from "../../actions";
import { requestGenerationAction, requestSuggestionsAction } from "../../ai-actions";
import { useAiJob } from "./use-ai-job";

export type SuggestionView = {
  id: string;
  recipeName: string;
  portionFactor: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type SuggestionsPanelProps = {
  slotId: string;
  date: string;
  suggestions: SuggestionView[];
  aiBudget: { used: number; limit: number } | null;
  aiBudgetError: string | null;
  initialJob: AiJobStatusView | null;
  alreadyLogged: boolean;
};

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

export function formatFactor(factor: number): string {
  const whole = Math.floor(factor);
  const frac = Math.round((factor - whole) * 100) / 100;
  const fracChar = FRACTIONS[frac] ?? "";
  if (whole === 0) return fracChar || String(factor);
  return `${whole}${fracChar}`;
}

function MacroRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line-200 py-2 text-sm last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="font-display text-base font-semibold text-ink-900">{value}</span>
    </div>
  );
}

export function SuggestionsPanel({
  slotId,
  date,
  suggestions,
  aiBudget,
  aiBudgetError,
  initialJob,
  alreadyLogged,
}: SuggestionsPanelProps) {
  const router = useRouter();
  const { job, track, processing } = useAiJob(initialJob);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = suggestions[Math.min(activeIndex, suggestions.length - 1)] ?? null;
  const emptyBank =
    job?.status === "COMPLETED" &&
    job.type === "SUGGEST" &&
    (job.result as SuggestResult | null)?.suggestionCount === 0 &&
    suggestions.length === 0;

  function requestSuggestions(force: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await requestSuggestionsAction({ mealSlotId: slotId, date, force });
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.jobId) {
        track(result.data.jobId);
      } else {
        router.refresh();
      }
    });
  }

  function requestGeneration() {
    setError(null);
    startTransition(async () => {
      const result = await requestGenerationAction({ mealSlotId: slotId, date });
      if (result.ok) {
        track(result.data.jobId);
      } else {
        setError(result.error);
      }
    });
  }

  function register(suggestionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await registerSuggestionMealAction({ suggestionId, date, notes: null });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {alreadyLogged && (
        <p className="rounded-xl bg-cream-200 px-4 py-3 text-sm text-ink-500">
          Você já registrou esta refeição hoje — desfaça na aba Dieta base para trocar.
        </p>
      )}

      {processing && (
        <div className="flex animate-shimmer items-center gap-2 rounded-2xl bg-cream-200 px-4 py-4 text-sm text-ink-500">
          <Icon name="sparkles" size={18} />
          {job?.type === "GENERATE"
            ? "Criando uma receita nova para você… pode levar um minutinho."
            : "Gerando sugestões… você pode continuar navegando."}
        </div>
      )}

      {!processing && job?.status === "FAILED" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
          <span className="min-w-0">{job.error ?? "A análise falhou."}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              job.type === "GENERATE" ? requestGeneration() : requestSuggestions(true)
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger-600 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Icon name="refresh" size={12} /> Tentar de novo
          </button>
        </div>
      )}

      {suggestions.length > 0 && !processing && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={
                  i === activeIndex
                    ? "whitespace-nowrap rounded-full bg-caramel-200 px-4 py-2 text-xs font-semibold text-ink-900"
                    : "whitespace-nowrap rounded-full border border-line-200 bg-cream-50 px-4 py-2 text-xs text-ink-500"
                }
              >
                Sugestão {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => requestSuggestions(true)}
              title="Novas sugestões"
              className="whitespace-nowrap rounded-full border border-line-200 bg-cream-50 px-3 py-2 text-xs text-ink-500 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              <Icon name="refresh" size={12} className="inline" /> Novas
            </button>
          </div>

          {active && (
            <div className="rounded-2xl border border-line-200 bg-cream-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-caramel-500">
                Sugestão da nutri·IA
              </p>
              <p className="mt-1 font-display text-lg font-semibold leading-snug text-ink-900">
                {active.recipeName}
              </p>
              <p className="text-xs text-ink-500">
                {formatFactor(active.portionFactor)} porção para bater sua meta
              </p>
              <div className="mt-2">
                <MacroRow label="Calorias" value={`${active.kcal} kcal`} />
                <MacroRow label="Proteína" value={`${active.proteinG} g`} />
                <MacroRow label="Carboidrato" value={`${active.carbsG} g`} />
                <MacroRow label="Gordura" value={`${active.fatG} g`} />
              </div>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-success-600">
                <Icon name="check" size={12} /> dentro da meta
              </span>
              {!alreadyLogged && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => register(active.id)}
                  className="mt-3 w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {pending ? "Registrando…" : "Registrar esta opção"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {suggestions.length === 0 && !processing && job?.status !== "FAILED" && (
        <div className="rounded-3xl border border-dashed border-line-200 bg-cream-50 px-6 py-8 text-center">
          <Icon name="sparkles" size={24} className="mx-auto text-caramel-500" />
          {emptyBank ? (
            <>
              <p className="mt-2 font-display text-base font-semibold text-ink-900">
                O banco ainda não tem opção que caiba nesta refeição
              </p>
              <p className="mt-1 text-sm text-ink-500">
                A IA pode criar uma receita nova sob medida para as suas metas.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={requestGeneration}
                className="mt-4 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
              >
                Gerar receita nova com IA
              </button>
              <p className="mt-2 text-[11px] text-ink-300">usa 1 análise do seu limite diário</p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-base font-semibold text-ink-900">
                Quer variar sem sair da dieta?
              </p>
              <p className="mt-1 text-sm text-ink-500">
                A IA escolhe receitas do banco que cabem exatamente nas suas metas.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => requestSuggestions(false)}
                className="mt-4 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
              >
                Ver sugestões da nutri·IA
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger-600">{error}</p>}

      {aiBudgetError ? (
        <p className="text-center text-[11px] text-ink-300">{aiBudgetError}</p>
      ) : aiBudget ? (
        <p className="text-center text-[11px] text-ink-300">
          {aiBudget.used} de {aiBudget.limit} análises de IA hoje
        </p>
      ) : null}
    </div>
  );
}
