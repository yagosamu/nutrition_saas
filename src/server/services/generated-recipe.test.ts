import { describe, expect, it } from "vitest";
import { validateGeneratedRecipe } from "./generated-recipe";

const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };
const arroz = { id: "i-arroz", kcalPer100g: 124, proteinGPer100g: 2.6, carbsGPer100g: 25.8, fatGPer100g: 1 };
const frango = { id: "i-frango", kcalPer100g: 159, proteinGPer100g: 32, carbsGPer100g: 0, fatGPer100g: 2.5 };
const azeite = { id: "i-azeite", kcalPer100g: 900, proteinGPer100g: 0, carbsGPer100g: 0, fatGPer100g: 100 };

describe("validateGeneratedRecipe", () => {
  it("recusa receita fora da tolerância e aponta o macro estourado", () => {
    const r = validateGeneratedRecipe(targets, [
      { ingredient: arroz, quantityG: 260 },
      { ingredient: frango, quantityG: 190 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.feedback).toContain("proteína");
  });

  it("dá feedback acionável com os totais calculados", () => {
    const r = validateGeneratedRecipe(targets, [{ ingredient: arroz, quantityG: 100 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.feedback).toContain("124"); // kcal calculada aparece no feedback
      expect(r.feedback).toContain("650"); // meta aparece no feedback
    }
  });

  it("aceita composição equilibrada", () => {
    const r = validateGeneratedRecipe(targets, [
      { ingredient: arroz, quantityG: 271 },
      { ingredient: frango, quantityG: 119 },
      { ingredient: azeite, quantityG: 14 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totals.kcal).toBeGreaterThan(617); // dentro de ±5% de 650
  });
});
