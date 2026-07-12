"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import type { AiJobStatusView, ExternalEvaluationResult } from "@/lib/types";
import { registerExternalMealAction } from "../../actions";
import { requestEvaluationAction } from "../../ai-actions";
import { formatFactor } from "./suggestions-panel";
import { useAiJob } from "./use-ai-job";

type ExternalPanelProps = {
  slotId: string;
  date: string;
  aiBudget: { used: number; limit: number } | null;
  aiBudgetError: string | null;
  initialJob: AiJobStatusView | null;
  alreadyLogged: boolean;
};

function VerdictCard({
  jobId,
  result,
  date,
  alreadyLogged,
}: {
  jobId: string;
  result: ExternalEvaluationResult;
  date: string;
  alreadyLogged: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function register() {
    setError(null);
    startTransition(async () => {
      const r = await registerExternalMealAction({ aiJobId: jobId, date, notes: null });
      if (r.ok) {
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  const tone =
    result.verdict === "FITS"
      ? "border-success-600/30 bg-success-100"
      : result.verdict === "FITS_WITH_PORTION"
        ? "border-line-200 bg-caramel-200/60"
        : "border-danger-600/30 bg-danger-100";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {result.recipeName}
      </p>
      {result.verdict === "FITS" && (
        <p className="mt-1 font-display text-lg font-semibold text-success-600">
          Cabe como está ✓
        </p>
      )}
      {result.verdict === "FITS_WITH_PORTION" && (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">
          Cabe comendo {formatFactor(result.factor)} da porção
        </p>
      )}
      {result.verdict === "DOES_NOT_FIT" && (
        <>
          <p className="mt-1 font-display text-lg font-semibold text-danger-600">
            Não cabe nesta refeição
          </p>
          {result.reason && <p className="mt-1 text-sm text-ink-500">{result.reason}</p>}
        </>
      )}

      <p className="mt-2 text-sm text-ink-900">
        {result.macros.kcal} kcal · {result.macros.proteinG}P · {result.macros.carbsG}C ·{" "}
        {result.macros.fatG}G
        {result.verdict !== "FITS" && " na porção ajustada"}
      </p>

      {result.unmappedIngredients.length > 0 && (
        <p className="mt-2 rounded-xl bg-cream-50 px-3 py-2 text-xs text-ink-500">
          <Icon name="alert" size={12} className="mr-1 inline" />
          Estimado sem: {result.unmappedIngredients.join(", ")} — avisamos a equipe para
          cadastrar.
        </p>
      )}

      {result.verdict !== "DOES_NOT_FIT" && !alreadyLogged && (
        <button
          type="button"
          disabled={pending}
          onClick={register}
          className="mt-3 w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Registrando…" : "Registrar nesta refeição"}
        </button>
      )}
      {result.verdict === "DOES_NOT_FIT" && (
        <p className="mt-2 text-xs text-ink-500">
          Que tal pedir uma sugestão da IA na aba ao lado?
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
    </div>
  );
}

export function ExternalPanel({
  slotId,
  date,
  aiBudget,
  aiBudgetError,
  initialJob,
  alreadyLogged,
}: ExternalPanelProps) {
  const { job, track, processing } = useAiJob(initialJob);
  const [mode, setMode] = useState<"text" | "url">("text");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestEvaluationAction({
        mealSlotId: slotId,
        date,
        text: mode === "text" ? value : null,
        url: mode === "url" ? value.trim() : null,
      });
      if (result.ok) {
        setValue("");
        track(result.data.jobId);
      } else {
        setError(result.error);
      }
    });
  }

  const verdict =
    job?.status === "COMPLETED" && job.type === "EVALUATE_EXTERNAL"
      ? (job.result as ExternalEvaluationResult)
      : null;

  return (
    <div className="space-y-3">
      {alreadyLogged && (
        <p className="rounded-xl bg-cream-200 px-4 py-3 text-sm text-ink-500">
          Você já registrou esta refeição hoje — desfaça na aba Dieta base para trocar.
        </p>
      )}

      <form onSubmit={submit} className="rounded-2xl border border-line-200 bg-cream-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
          Achou uma receita na internet?
        </p>
        <p className="mt-1 text-sm text-ink-500">
          A IA verifica se ela cabe nesta refeição — e em que porção.
        </p>
        <div className="mt-3 flex gap-2">
          {(
            [
              ["text", "Colar texto"],
              ["url", "Link"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setValue("");
              }}
              className={
                mode === m
                  ? "rounded-full bg-caramel-200 px-4 py-1.5 text-xs font-semibold text-ink-900"
                  : "rounded-full border border-line-200 px-4 py-1.5 text-xs text-ink-500"
              }
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "text" ? (
          <>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={5}
              maxLength={20000}
              required
              placeholder="Cole aqui os ingredientes e o preparo da receita…"
              className="mt-3 w-full rounded-xl border border-line-200 bg-cream-100 px-3 py-2.5 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
            />
            <p className="text-right text-[11px] text-ink-300">{value.length} / 20000</p>
          </>
        ) : (
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            placeholder="https://…"
            className="mt-3 w-full rounded-xl border border-line-200 bg-cream-100 px-3 py-2.5 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
          />
        )}
        <button
          type="submit"
          disabled={pending || processing}
          className="mt-3 w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Analisar receita"}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink-300">
          usa 1 análise do seu limite diário
        </p>
      </form>

      {processing && (
        <div className="flex animate-shimmer items-center gap-2 rounded-2xl bg-cream-200 px-4 py-4 text-sm text-ink-500">
          <Icon name="sparkles" size={18} />
          Analisando a receita… você pode continuar navegando.
        </div>
      )}

      {!processing && job?.status === "FAILED" && (
        <div className="rounded-2xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
          {job.error ?? "A análise falhou."} — ajuste e envie de novo.
        </div>
      )}

      {!processing && verdict && (
        <VerdictCard jobId={job!.id} result={verdict} date={date} alreadyLogged={alreadyLogged} />
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
