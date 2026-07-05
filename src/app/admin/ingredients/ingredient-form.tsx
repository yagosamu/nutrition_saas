"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveIngredientAction } from "./actions";

type IngredientFormProps = {
  id: string | null;
  initial?: {
    name: string;
    source: string;
    kcalPer100g: number;
    proteinGPer100g: number;
    carbsGPer100g: number;
    fatGPer100g: number;
    fiberGPer100g: number | null;
  };
};

const inputClass =
  "w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-ink-900";

export function IngredientForm({ id, initial }: IngredientFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOfficial = initial != null && initial.source !== "CUSTOM";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveIngredientAction(id, formData);
      if (result.ok) {
        router.push("/admin/ingredients");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {isOfficial && (
        <p className="mb-4 rounded-lg bg-caramel-200 px-4 py-3 text-sm text-ink-900">
          Ingrediente de tabela oficial ({initial.source}) — edite apenas para
          corrigir erro de importação.
        </p>
      )}

      <div className="rounded-xl border border-line-200 bg-cream-50 p-6">
        <label className={labelClass}>
          Nome
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={initial?.name}
            className={inputClass}
          />
        </label>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Valores por 100 g
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <label className={labelClass}>
            Calorias (kcal)
            <input
              type="number"
              name="kcalPer100g"
              required
              min={0}
              max={900}
              step="0.1"
              defaultValue={initial?.kcalPer100g}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Proteína (g)
            <input
              type="number"
              name="proteinGPer100g"
              required
              min={0}
              max={100}
              step="0.1"
              defaultValue={initial?.proteinGPer100g}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Carboidrato (g)
            <input
              type="number"
              name="carbsGPer100g"
              required
              min={0}
              max={100}
              step="0.1"
              defaultValue={initial?.carbsGPer100g}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Gordura (g)
            <input
              type="number"
              name="fatGPer100g"
              required
              min={0}
              max={100}
              step="0.1"
              defaultValue={initial?.fatGPer100g}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Fibra (g) — opcional
            <input
              type="number"
              name="fiberGPer100g"
              min={0}
              max={100}
              step="0.1"
              defaultValue={initial?.fiberGPer100g ?? ""}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Salvando…" : id ? "Salvar alterações" : "Criar ingrediente"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/ingredients")}
          className="rounded-full border border-line-200 px-5 py-2.5 text-sm text-ink-500 hover:text-ink-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
