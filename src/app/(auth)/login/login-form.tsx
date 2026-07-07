"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "../actions";

export function LoginForm({ passwordChanged }: { passwordChanged: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {passwordChanged && (
        <p className="rounded-xl bg-success-100 px-4 py-3 text-sm text-success-600">
          Senha alterada com sucesso. Entre novamente.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-xl border border-line-200 bg-cream-50 px-4 py-3 text-base placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
        Senha
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-xl border border-line-200 bg-cream-50 px-4 py-3 text-base focus:border-brand-500 focus:outline-none"
        />
      </label>
      {state?.error && <p className="text-sm text-danger-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand-500 px-4 py-3 font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
