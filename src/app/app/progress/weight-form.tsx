"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerWeightAction } from "../actions";

export function WeightForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    const weightKg = Number(value.replace(",", "."));
    startTransition(async () => {
      const result = await registerWeightAction({ weightKg });
      if (result.ok) {
        setValue("");
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
        Peso de hoje
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            step="0.1"
            min="20"
            max="400"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="72,5"
            className="w-full rounded-xl border border-line-200 bg-cream-100 px-3 py-2.5 pr-10 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-300">
            kg
          </span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="shrink-0 rounded-full bg-brand-500 px-4 py-2.5 text-xs font-semibold text-cream-50 hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Registrando…" : "Registrar peso de hoje"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-300">
        {saved
          ? "Peso registrado ✓"
          : "1 registro por dia — registrar de novo substitui o de hoje."}
      </p>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
