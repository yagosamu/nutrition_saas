"use client";

import { useState } from "react";

export function TempPasswordPanel({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border-2 border-brand-500 bg-brand-100 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
        Senha provisória
      </p>
      <div className="mt-2 flex items-center gap-3">
        <code className="rounded-lg bg-cream-50 px-4 py-2 font-mono text-lg tracking-wide text-ink-900">
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-brand-500 px-4 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-500 hover:text-cream-50"
        >
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-900">
        Anote agora — ela <strong>não será exibida novamente</strong>. O
        paciente trocará a senha no primeiro acesso.
      </p>
    </div>
  );
}
