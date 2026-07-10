"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import {
  registerFreeMealAction,
  registerPlanMealAction,
  skipMealAction,
  undoMealAction,
} from "../../actions";

type MealActionsProps = {
  slotId: string;
  date: string;
  baseKcal: number;
  log: {
    status: "COMPLETED" | "SKIPPED";
    type: string | null;
    freeDescription: string | null;
    notes: string | null;
    consumedKcal: number;
  } | null;
};

const inputClass =
  "w-full rounded-xl border border-line-200 bg-cream-100 px-3 py-2.5 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-ink-900";

export function MealActions({ slotId, date, baseKcal, log }: MealActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "free">("idle");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMode("idle");
        router.refresh();
      } else {
        setError(result.error ?? "Algo deu errado");
      }
    });
  }

  // ---- estado registrado / pulado ----
  if (log) {
    return (
      <div className="rounded-2xl border border-line-200 bg-cream-50 p-4">
        {log.status === "COMPLETED" ? (
          <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-success-600">
              <Icon name="check" size={12} /> Registrada · {log.consumedKcal} kcal
            </p>
            {log.type === "FREE_ENTRY" && (
              <p className="mt-2 text-sm text-ink-900">
                Registro livre: <em>{log.freeDescription}</em>
                <span className="block text-xs text-ink-300">
                  valores estimados por você
                </span>
              </p>
            )}
            {log.notes && (
              <p className="mt-2 text-sm text-ink-500">“{log.notes}”</p>
            )}
          </>
        ) : (
          <p className="inline-flex items-center rounded-full bg-cream-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Refeição pulada
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => undoMealAction({ mealSlotId: slotId, date }))}
          className="mt-3 block text-xs text-ink-300 underline hover:text-danger-600 disabled:opacity-50"
        >
          {pending ? "Desfazendo…" : "Desfazer (só hoje)"}
        </button>
        {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
      </div>
    );
  }

  // ---- formulário de registro livre ----
  if (mode === "free") {
    function submitFree(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      run(() =>
        registerFreeMealAction({
          mealSlotId: slotId,
          date,
          notes: notes.trim() || null,
          description: fd.get("description"),
          kcal: fd.get("kcal"),
          proteinG: fd.get("proteinG") || 0,
          carbsG: fd.get("carbsG") || 0,
          fatG: fd.get("fatG") || 0,
        }),
      );
    }

    return (
      <form
        onSubmit={submitFree}
        className="space-y-3 rounded-2xl border border-line-200 bg-cream-50 p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
          Registro livre
        </p>
        <p className="rounded-xl bg-caramel-200/60 px-3 py-2 text-xs text-ink-900">
          Estimativa sua — fica marcada como registro livre para você e para a
          equipe.
        </p>
        <label className={labelClass}>
          O que você comeu?
          <input
            type="text"
            name="description"
            required
            maxLength={300}
            placeholder="Ex: pizza de frango (2 fatias)"
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-4 gap-2">
          <label className={labelClass}>
            kcal
            <input type="number" name="kcal" required min={0} max={5000} className={inputClass} />
          </label>
          <label className={labelClass}>
            Prot. (g)
            <input type="number" name="proteinG" min={0} max={500} className={inputClass} />
          </label>
          <label className={labelClass}>
            Carbo (g)
            <input type="number" name="carbsG" min={0} max={800} className={inputClass} />
          </label>
          <label className={labelClass}>
            Gord. (g)
            <input type="number" name="fatG" min={0} max={300} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          Observação (opcional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Ex: almoço de aniversário"
            className={inputClass}
          />
        </label>
        {error && <p className="text-xs text-danger-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-brand-500 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "Registrando…" : "Registrar"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded-full border border-line-200 px-5 py-3 text-sm text-ink-500"
          >
            Voltar
          </button>
        </div>
      </form>
    );
  }

  // ---- escolha do caminho ----
  return (
    <div className="space-y-3 rounded-2xl border border-line-200 bg-cream-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
        Registrar esta refeição
      </p>
      <label className={labelClass}>
        Observação (opcional)
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Ex: troquei o arroz por batata"
          className={inputClass}
        />
      </label>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      <button
        type="button"
        disabled={pending || baseKcal === 0}
        onClick={() =>
          run(() =>
            registerPlanMealAction({
              mealSlotId: slotId,
              date,
              notes: notes.trim() || null,
            }),
          )
        }
        className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Segui o plano"}
      </button>
      {baseKcal === 0 && (
        <p className="-mt-1 text-center text-[11px] text-ink-300">
          Sem dieta base nesta refeição — use o registro livre.
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("free")}
        className="w-full rounded-full border border-line-200 py-3 text-sm text-ink-900 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
      >
        Comi outra coisa (registro livre)
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => skipMealAction({ mealSlotId: slotId, date }))}
        className="w-full rounded-full py-2 text-sm text-ink-300 hover:text-danger-600 disabled:opacity-50"
      >
        Pular refeição
      </button>
    </div>
  );
}
