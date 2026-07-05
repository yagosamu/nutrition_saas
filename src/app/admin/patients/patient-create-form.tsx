"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { createPatientAction } from "./actions";
import { TempPasswordPanel } from "./temp-password-panel";

const inputClass =
  "w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-ink-900";

export function PatientCreateForm() {
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; tempPassword: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createPatientAction(formData);
      if (result.ok) {
        setCreated(result.data);
      } else {
        setError(result.error);
      }
    });
  }

  if (created) {
    return (
      <div className="max-w-xl space-y-4">
        <TempPasswordPanel password={created.tempPassword} />
        <div className="flex gap-3">
          <Link
            href={`/admin/patients/${created.id}`}
            className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-brand-600"
          >
            Abrir paciente
          </Link>
          <Link
            href={`/admin/patients/${created.id}/plan`}
            className="rounded-full border border-line-200 px-5 py-2.5 text-sm text-ink-500 hover:text-brand-600"
          >
            Montar plano alimentar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="space-y-4 rounded-xl border border-line-200 bg-cream-50 p-6">
        <label className={labelClass}>
          Nome completo
          <input type="text" name="name" required minLength={2} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email (login do paciente)
          <input type="email" name="email" required className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Data de nascimento
            <input type="date" name="birthDate" className={inputClass} />
          </label>
          <label className={labelClass}>
            Sexo
            <select name="sex" defaultValue="" className={inputClass}>
              <option value="">Não informar</option>
              <option value="FEMALE">Feminino</option>
              <option value="MALE">Masculino</option>
            </select>
          </label>
        </div>
        <label className={labelClass}>
          Notas da equipe (o paciente não vê)
          <textarea name="teamNotes" rows={3} className={inputClass} />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Criando…" : "Criar paciente"}
      </button>
    </form>
  );
}
