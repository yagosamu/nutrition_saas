import { describe, expect, it } from "vitest";
import {
  registerPlanMealWith,
  registerFreeMealWith,
  skipMealWith,
  undoMealWith,
  type MealLogDeps,
} from "./meal-logs";

const TODAY = "2026-07-05";
const baseTotals = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

function makeDeps(overrides?: Partial<MealLogDeps>) {
  const upserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const deps: MealLogDeps = {
    getSlotForPatient: async () => ({ slotId: "s1", baseTotals }),
    upsertLog: async (data) => {
      upserts.push(data as Record<string, unknown>);
      return { id: "log1" };
    },
    deleteLog: async (_patientId, slotId) => {
      deletes.push(slotId);
      return true;
    },
    today: () => TODAY,
    ...overrides,
  };
  return { deps, upserts, deletes };
}

describe("registerPlanMealWith", () => {
  const input = { mealSlotId: "s1", date: TODAY, notes: null };

  it("congela o snapshot da dieta base calculado no servidor", async () => {
    const { deps, upserts } = makeDeps();
    const result = await registerPlanMealWith(deps, "p1", input);
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({
      patientId: "p1",
      mealSlotId: "s1",
      status: "COMPLETED",
      type: "PLAN",
      kcal: 650,
      proteinG: 45,
      carbsG: 70,
      fatG: 20,
    });
  });

  it("recusa data que não é hoje", async () => {
    const { deps } = makeDeps();
    const result = await registerPlanMealWith(deps, "p1", { ...input, date: "2026-07-04" });
    expect(result).toEqual({ ok: false, error: "Só é possível registrar o dia de hoje" });
  });

  it("recusa slot que não pertence ao plano ativo do paciente", async () => {
    const { deps } = makeDeps({ getSlotForPatient: async () => null });
    const result = await registerPlanMealWith(deps, "p1", input);
    expect(result).toEqual({ ok: false, error: "Refeição não encontrada no seu plano" });
  });
});

describe("registerFreeMealWith", () => {
  it("usa os números do paciente e marca FREE_ENTRY", async () => {
    const { deps, upserts } = makeDeps();
    const result = await registerFreeMealWith(deps, "p1", {
      mealSlotId: "s1",
      date: TODAY,
      notes: null,
      description: "Pizza (2 fatias)",
      kcal: 540,
      proteinG: 22,
      carbsG: 60,
      fatG: 24,
    });
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({
      type: "FREE_ENTRY",
      freeDescription: "Pizza (2 fatias)",
      kcal: 540,
    });
  });
});

describe("skipMealWith", () => {
  it("registra SKIPPED com macros zerados", async () => {
    const { deps, upserts } = makeDeps();
    const result = await skipMealWith(deps, "p1", { mealSlotId: "s1", date: TODAY });
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({ status: "SKIPPED", kcal: 0, proteinG: 0 });
  });
});

describe("undoMealWith", () => {
  it("desfaz registro de hoje", async () => {
    const { deps, deletes } = makeDeps();
    const result = await undoMealWith(deps, "p1", { mealSlotId: "s1", date: TODAY });
    expect(result.ok).toBe(true);
    expect(deletes).toEqual(["s1"]);
  });

  it("recusa desfazer dia passado", async () => {
    const { deps } = makeDeps();
    const result = await undoMealWith(deps, "p1", { mealSlotId: "s1", date: "2026-07-01" });
    expect(result).toEqual({ ok: false, error: "Só é possível editar o dia de hoje" });
  });
});
