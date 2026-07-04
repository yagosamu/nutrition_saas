import { describe, expect, it } from "vitest";
import { saveTeamRecipeWith, type RecipeDeps, type RecipePersistData } from "./recipes";

const arroz = { id: "ing-arroz", kcalPer100g: 124, proteinGPer100g: 2.6, carbsGPer100g: 25.8, fatGPer100g: 1 };

const input = {
  name: "Arroz solto",
  instructions: "Cozinhe.",
  servings: 2,
  suitableMealTypes: ["LUNCH" as const],
  ingredients: [{ ingredientId: "ing-arroz", quantityG: 200 }],
};

function makeDeps() {
  const persisted: RecipePersistData[] = [];
  const deps: RecipeDeps = {
    findIngredientMacros: async () => [arroz],
    persist: async (data) => {
      persisted.push(data);
      return { id: "r1" };
    },
  };
  return { deps, persisted };
}

describe("saveTeamRecipeWith", () => {
  it("calcula totais por porção pelo sistema e persiste APPROVED/TEAM", async () => {
    const { deps, persisted } = makeDeps();
    const result = await saveTeamRecipeWith(deps, input, null);
    expect(result).toEqual({ ok: true, data: { id: "r1" } });
    expect(persisted[0]).toMatchObject({
      id: null,
      status: "APPROVED",
      origin: "TEAM",
      // 200g arroz = 248 kcal / 2 porções = 124
      kcalPerServing: 124,
      proteinGPerServing: 2.6,
      carbsGPerServing: 25.8,
      fatGPerServing: 1,
    });
  });

  it("recusa ingrediente inexistente no banco", async () => {
    const { deps } = makeDeps();
    deps.findIngredientMacros = async () => [];
    const result = await saveTeamRecipeWith(deps, input, null);
    expect(result).toEqual({ ok: false, error: "Ingrediente não encontrado: ing-arroz" });
  });

  it("recusa ingrediente duplicado na lista", async () => {
    const { deps } = makeDeps();
    const dup = { ...input, ingredients: [...input.ingredients, { ingredientId: "ing-arroz", quantityG: 50 }] };
    const result = await saveTeamRecipeWith(deps, dup, null);
    expect(result).toEqual({ ok: false, error: "Ingrediente repetido na receita" });
  });
});
