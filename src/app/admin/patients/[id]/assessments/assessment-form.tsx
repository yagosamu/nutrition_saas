"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createAssessmentAction, deleteAssessmentAction } from "./actions";

const FIELDS: { name: string; label: string; step?: string }[] = [
  { name: "weightKg", label: "Peso (kg)", step: "0.1" },
  { name: "heightCm", label: "Altura (cm)", step: "0.1" },
  { name: "waistCm", label: "Cintura (cm)", step: "0.1" },
  { name: "hipCm", label: "Quadril (cm)", step: "0.1" },
  { name: "chestCm", label: "Peito (cm)", step: "0.1" },
  { name: "armCm", label: "Braço (cm)", step: "0.1" },
  { name: "thighCm", label: "Coxa (cm)", step: "0.1" },
  { name: "bodyFatPct", label: "% Gordura", step: "0.1" },
  { name: "muscleMassKg", label: "Massa magra (kg)", step: "0.1" },
];

export function AssessmentForm({
  patientId,
  today,
}: {
  patientId: string;
  today: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAssessmentAction(patientId, formData);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600"
      >
        Nova avaliação
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="rounded-xl border border-line-200 bg-cream-50 p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Nova avaliação
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-500 hover:text-brand-600"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        <label className="block">
          <span className="text-xs text-ink-500">Data</span>
          <input
            type="date"
            name="date"
            defaultValue={today}
            required
            className="mt-1 w-full rounded-lg border border-line-200 bg-cream-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        {FIELDS.map((f) => (
          <label key={f.name} className="block">
            <span className="text-xs text-ink-500">{f.label}</span>
            <input
              type="number"
              name={f.name}
              step={f.step}
              min="0"
              className="mt-1 w-full rounded-lg border border-line-200 bg-cream-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-ink-500">Observações</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-line-200 bg-cream-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </label>

      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

      <div className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar avaliação"}
        </button>
      </div>
    </form>
  );
}

export function DeleteAssessmentButton({
  id,
  patientId,
}: {
  id: string;
  patientId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Excluir esta avaliação? Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const result = await deleteAssessmentAction(id, patientId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={remove}
      className="text-xs font-semibold text-danger-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Excluindo…" : "Excluir"}
    </button>
  );
}
