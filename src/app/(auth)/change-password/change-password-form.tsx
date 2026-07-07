"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "../actions";

const inputClass =
  "rounded-xl border border-line-200 bg-cream-50 px-4 py-3 text-base focus:border-brand-500 focus:outline-none";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
        Senha atual
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
        Nova senha
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
        Confirmar nova senha
        <input
          type="password"
          name="confirmPassword"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      {state?.error && <p className="text-sm text-danger-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand-500 px-4 py-3 font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Alterar senha"}
      </button>
    </form>
  );
}
