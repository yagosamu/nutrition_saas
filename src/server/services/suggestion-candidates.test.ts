import { describe, expect, it } from "vitest";
import { selectCandidates, type CandidateRecipe } from "./suggestion-candidates";

const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

function recipe(id: string, kcal: number, p: number, c: number, f: number): CandidateRecipe {
  return { id, name: id, kcalPerServing: kcal, proteinGPerServing: p, carbsGPerServing: c, fatGPerServing: f };
}

describe("selectCandidates", () => {
  it("mantém só receitas que cabem em algum fator e devolve o fit", () => {
    const fits = recipe("cabe", 516, 38.4, 41.6, 14.4); // 1.25x = 645 kcal ok
    const tooFat = recipe("gorda", 650, 10, 20, 55);
    const result = selectCandidates(targets, [fits, tooFat]);
    expect(result.map((r) => r.recipe.id)).toEqual(["cabe"]);
    expect(result[0].fit.factor).toBe(1.25);
  });

  it("lista vazia devolve vazio", () => {
    expect(selectCandidates(targets, [])).toEqual([]);
  });
});
