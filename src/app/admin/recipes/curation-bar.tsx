"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveRecipeAction, rejectRecipeAction } from "./curation-actions";

type CurationBarProps = {
  recipeId: string;
  originLabel: string; // "Gerada pela IA" | "Receita externa"
  patientName: string | null;
  createdAtLabel: string;
};

export function CurationBar({ recipeId, originLabel, patientName, createdAtLabel }: CurationBarProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, confirmText: string) {
    if (!confirm(confirmText)) return;
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

  return (
    <div className="mb-6 rounded-xl border-2 border-caramel-500 bg-caramel-200/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-900">
        ⏳ Fila de curadoria
      </p>
      <p className="mt-1 text-sm text-ink-500">
        {originLabel}
        {patientName ? ` para ${patientName}` : ""} em {createdAtLabel}. Já vale para o
        paciente de origem — aprovar libera para todos.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => approveRecipeAction(recipeId), "Aprovar esta receita para o banco geral?")
          }
          className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Processando…" : "Aprovar para o banco"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => rejectRecipeAction(recipeId),
              "Rejeitar? A receita continua valendo só para o paciente de origem.",
            )
          }
          className="rounded-full border border-line-200 px-5 py-2 text-sm text-ink-500 hover:border-danger-600 hover:text-danger-600 disabled:opacity-50"
        >
          Rejeitar (fica só do paciente)
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
