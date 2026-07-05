"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { resetPatientPasswordAction, updatePatientAction } from "./actions";
import { TempPasswordPanel } from "./temp-password-panel";

type PatientEditFormProps = {
  userId: string;
  initial: {
    name: string;
    birthDate: string | null; // yyyy-MM-dd
    sex: "MALE" | "FEMALE" | null;
    teamNotes: string | null;
    dailyAiLimit: number;
    active: boolean;
  };
};

const inputClass =
  "w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-ink-900";

export function PatientEditForm({ userId, initial }: PatientEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePatientAction(userId, formData);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleResetPassword() {
    if (!confirm("Redefinir a senha deste paciente? A senha atual deixa de funcionar.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetPatientPasswordAction(userId);
      if (result.ok) {
        setTempPassword(result.data.tempPassword);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      {tempPassword && <TempPasswordPanel password={tempPassword} />}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-xl border border-line-200 bg-cream-50 p-6">
          <label className={labelClass}>
            Nome completo
            <input
              type="text"
              name="name"
              required
              minLength={2}
              defaultValue={initial.name}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Data de nascimento
              <input
                type="date"
                name="birthDate"
                defaultValue={initial.birthDate ?? ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Sexo
              <select name="sex" defaultValue={initial.sex ?? ""} className={inputClass}>
                <option value="">Não informar</option>
                <option value="FEMALE">Feminino</option>
                <option value="MALE">Masculino</option>
              </select>
            </label>
          </div>
          <label className={labelClass}>
            Notas da equipe (o paciente não vê)
            <textarea
              name="teamNotes"
              rows={3}
              defaultValue={initial.teamNotes ?? ""}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 items-end gap-4">
            <label className={labelClass}>
              Limite de operações de IA por dia
              <input
                type="number"
                name="dailyAiLimit"
                required
                min={0}
                max={100}
                defaultValue={initial.dailyAiLimit}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm font-medium text-ink-900">
              <input
                type="checkbox"
                name="active"
                defaultChecked={initial.active}
                className="h-4 w-4 accent-brand-500"
              />
              Paciente ativo (pode fazer login)
            </label>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="mt-3 text-sm text-brand-600">Alterações salvas.</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={pending}
            className="rounded-full border border-line-200 px-5 py-2.5 text-sm text-ink-500 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
          >
            Redefinir senha
          </button>
        </div>
      </form>
    </div>
  );
}
