import { describe, expect, it } from "vitest";
import { checkAiBudgetWith, type AiBudgetDeps } from "./ai-budget";

function makeDeps(used: number, limit = 10): AiBudgetDeps {
  return {
    getDailyLimit: async () => limit,
    countExpensiveJobsToday: async () => used,
  };
}

describe("checkAiBudgetWith", () => {
  it("permite quando há saldo", async () => {
    const r = await checkAiBudgetWith(makeDeps(3), "p1");
    expect(r).toEqual({ ok: true, data: { used: 3, limit: 10, remaining: 7 } });
  });

  it("bloqueia no limite com mensagem clara", async () => {
    const r = await checkAiBudgetWith(makeDeps(10), "p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("limite");
  });

  it("limite 0 bloqueia sempre", async () => {
    const r = await checkAiBudgetWith(makeDeps(0, 0), "p1");
    expect(r.ok).toBe(false);
  });
});
