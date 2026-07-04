// Matemática nutricional pura e isomórfica (client + server).
// ÚNICA fonte de cálculo de macros do sistema — nunca duplicar esta aritmética.
import type { IngredientMacros, MacroTotals } from "./types";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scalePer100(macros: IngredientMacros, grams: number): MacroTotals {
  const f = grams / 100;
  return {
    kcal: round1(macros.kcalPer100g * f),
    proteinG: round1(macros.proteinGPer100g * f),
    carbsG: round1(macros.carbsGPer100g * f),
    fatG: round1(macros.fatGPer100g * f),
  };
}

export function scaleServing(perServing: MacroTotals, servings: number): MacroTotals {
  return {
    kcal: round1(perServing.kcal * servings),
    proteinG: round1(perServing.proteinG * servings),
    carbsG: round1(perServing.carbsG * servings),
    fatG: round1(perServing.fatG * servings),
  };
}

export function sumMacros(list: MacroTotals[]): MacroTotals {
  return list.reduce(
    (acc, m) => ({
      kcal: round1(acc.kcal + m.kcal),
      proteinG: round1(acc.proteinG + m.proteinG),
      carbsG: round1(acc.carbsG + m.carbsG),
      fatG: round1(acc.fatG + m.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export type RecipeIngredientAmount = {
  quantityG: number;
  ingredient: IngredientMacros;
};

export function computeRecipeTotals(
  items: RecipeIngredientAmount[],
  servings: number,
): MacroTotals {
  if (servings <= 0) throw new Error("Rendimento deve ser positivo");
  const total = sumMacros(items.map((i) => scalePer100(i.ingredient, i.quantityG)));
  return {
    kcal: round1(total.kcal / servings),
    proteinG: round1(total.proteinG / servings),
    carbsG: round1(total.carbsG / servings),
    fatG: round1(total.fatG / servings),
  };
}
