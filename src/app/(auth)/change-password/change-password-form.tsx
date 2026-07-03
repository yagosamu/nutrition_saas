"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "../actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    undefined,
  );

  const inputClass =
    "rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Senha atual
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
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
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Confirmar nova senha
        <input
          type="password"
          name="confirmPassword"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Alterar senha"}
      </button>
    </form>
  );
}
