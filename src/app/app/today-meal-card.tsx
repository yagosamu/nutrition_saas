"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { registerPlanMealAction, saveDiaryNoteAction, undoMealAction } from "./actions";

export type TodaySlot = {
  slotId: string;
  name: string;
  timeHint: string | null;
  targetKcal: number;
  baseKcal: number;
  log: {
    status: "COMPLETED" | "SKIPPED";
    type: string | null;
    consumedKcal: number;
    freeDescription: string | null;
  } | null;
};

export function TodayMealCard({ slot, date }: { slot: TodaySlot; date: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Algo deu errado");
      }
    });
  }

  const detailHref = `/app/meals/${slot.slotId}`;

  if (slot.log?.status === "COMPLETED") {
    return (
      <div className="rounded-2xl border border-line-200 bg-cream-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-ink-900">
              {slot.name}
            </p>
            <p className="truncate text-xs text-ink-500">
              {slot.log.consumedKcal} kcal registradas
              {slot.log.type === "FREE_ENTRY" && " · registro livre"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-success-600">
            <Icon name="check" size={12} /> registrada
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <Link href={detailHref} className="text-brand-600 hover:underline">
            Ver detalhes
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => undoMealAction({ mealSlotId: slot.slotId, date }))}
            className="text-ink-300 underline hover:text-danger-600 disabled:opacity-50"
          >
            {pending ? "Desfazendo…" : "Desfazer"}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      </div>
    );
  }

  if (slot.log?.status === "SKIPPED") {
    return (
      <div className="rounded-2xl border border-line-200 bg-cream-50 px-4 py-3 opacity-80">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-base font-semibold text-ink-500">
            {slot.name}
          </p>
          <span className="rounded-full bg-cream-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-300">
            pulada
          </span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => undoMealAction({ mealSlotId: slot.slotId, date }))}
          className="mt-1 text-xs text-ink-300 underline hover:text-brand-600 disabled:opacity-50"
        >
          {pending ? "Desfazendo…" : "Desfazer"}
        </button>
        {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-[1.5px] border-brand-500/60 bg-cream-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base font-semibold text-ink-900">{slot.name}</p>
        <p className="shrink-0 text-xs text-ink-500">
          {slot.timeHint ? `${slot.timeHint} · ` : ""}meta {slot.targetKcal} kcal
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || slot.baseKcal === 0}
          onClick={() =>
            run(() =>
              registerPlanMealAction({ mealSlotId: slot.slotId, date, notes: null }),
            )
          }
          className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Registrando…" : "Segui o plano"}
        </button>
        <Link
          href={detailHref}
          className="rounded-full border border-line-200 px-4 py-2 text-xs text-ink-500 hover:border-brand-500 hover:text-brand-600"
        >
          Outras opções
        </Link>
      </div>
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
    </div>
  );
}

export function DayNoteForm({ date, initial }: { date: string; initial: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveDiaryNoteAction({ date, text });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line-200 bg-cream-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
        Como foi seu dia?
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={2}
        maxLength={2000}
        placeholder="Observações, como se sentiu, dúvidas para a nutri…"
        className="mt-2 w-full rounded-xl border border-line-200 bg-cream-100 px-3 py-2.5 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-ink-300">
          {saved ? "Salvo ✓" : "A equipe também lê suas notas"}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-full border border-line-200 px-4 py-1.5 text-xs font-semibold text-brand-600 hover:border-brand-500 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar nota"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
