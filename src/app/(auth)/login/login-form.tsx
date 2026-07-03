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
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Senha alterada com sucesso. Entre novamente.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Senha
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
