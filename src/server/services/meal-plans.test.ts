import { describe, expect, it } from "vitest";
import { diffSlots, saveMealPlanWith, type MealPlanDeps } from "./meal-plans";
import type { MealPlanData } from "@/lib/validation/meal-plan";

const slotBase = {
  name: "Almoço",
  order: 0,
  mealType: "LUNCH" as const,
  timeHint: null,
  kcal: 650,
  proteinG: 45,
  carbsG: 70,
  fatG: 20,
  items: [{ ingredientId: "ing-1", quantityG: 100, recipeId: null, servings: null }],
};

const plan: MealPlanData = {
  dailyKcal: 1800,
  dailyProteinG: 130,
  dailyCarbsG: 180,
  dailyFatG: 60,
  slots: [{ ...slotBase, id: null }],
};

describe("diffSlots", () => {
  it("separa criação, atualização e remoção", () => {
    const incoming = [
      { ...slotBase, id: "s1" },
      { ...slotBase, id: null, name: "Jantar" },
    ];
    const diff = diffSlots(["s1", "s2"], incoming);
    expect(diff.toUpdate.map((s) => s.id)).toEqual(["s1"]);
    expect(diff.toCreate.map((s) => s.name)).toEqual(["Jantar"]);
    expect(diff.toDeleteIds).toEqual(["s2"]);
  });

  it("recusa slot com id que não pertence ao plano", () => {
    expect(() => diffSlots(["s1"], [{ ...slotBase, id: "intruso" }])).toThrow();
  });
});

describe("saveMealPlanWith", () => {
  it("cria plano novo quando o paciente não tem plano ativo", async () => {
    const calls: string[] = [];
    const deps: MealPlanDeps = {
      getActivePlan: async () => null,
      createPlanWithSlots: async () => {
        calls.push("create");
        return { id: "p1" };
      },
      applyPlanUpdate: async () => {
        calls.push("update");
      },
    };
    const result = await saveMealPlanWith(deps, "patient-1", plan);
    expect(result).toEqual({ ok: true, data: { id: "p1" } });
    expect(calls).toEqual(["create"]);
  });

  it("atualiza plano existente com o diff de slots", async () => {
    let received: unknown = null;
    const deps: MealPlanDeps = {
      getActivePlan: async () => ({ id: "p1", slotIds: ["s1"] }),
      createPlanWithSlots: async () => {
        throw new Error("não deve criar");
      },
      applyPlanUpdate: async (planId, _targets, diff) => {
        received = { planId, deletes: diff.toDeleteIds.length };
      },
    };
    const result = await saveMealPlanWith(deps, "patient-1", {
      ...plan,
      slots: [{ ...slotBase, id: null, name: "Café" }],
    });
    expect(result.ok).toBe(true);
    expect(received).toEqual({ planId: "p1", deletes: 1 });
  });
});
