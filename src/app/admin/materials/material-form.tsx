"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createMaterialAction, deleteMaterialAction } from "./actions";

export function MaterialForm({
  fixedPatientId,
  patients,
}: {
  /** Quando definido, o material é sempre atribuído a este paciente (form inline da aba). */
  fixedPatientId?: string;
  /** Lista para o select do admin global — com opção "Todos os pacientes". */
  patients?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMaterialAction(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="rounded-xl border border-line-200 bg-cream-50 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
        {fixedPatientId ? "Atribuir material por link" : "Novo material por link"}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-44 flex-1">
          <span className="text-xs text-ink-500">Título</span>
          <input
            type="text"
            name="title"
            required
            maxLength={160}
            placeholder="Ex.: Guia de substituições"
            className="mt-1 w-full rounded-lg border border-line-200 bg-cream-100 px-3 py-2 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="block min-w-56 flex-1">
          <span className="text-xs text-ink-500">Link (URL)</span>
          <input
            type="url"
            name="url"
            required
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-line-200 bg-cream-100 px-3 py-2 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
          />
        </label>
        {fixedPatientId ? (
          <input type="hidden" name="patientId" value={fixedPatientId} />
        ) : (
          <label className="block min-w-44">
            <span className="text-xs text-ink-500">Para quem</span>
            <select
              name="patientId"
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-line-200 bg-cream-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">Todos os pacientes</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Adicionar"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
    </form>
  );
}

export function DeleteMaterialButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Excluir este material? Ele some para os pacientes.")) return;
    startTransition(async () => {
      const result = await deleteMaterialAction(id);
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
