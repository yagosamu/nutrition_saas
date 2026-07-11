import { computeRecipeTotals, fitPortionToTarget } from "@/lib/nutrition";
import type { IngredientMacros, MacroTotals } from "@/lib/types";

export type GeneratedIngredient = {
  ingredient: IngredientMacros & { id: string };
  quantityG: number;
};

export type GeneratedValidation =
  | { ok: true; totals: MacroTotals }
  | { ok: false; feedback: string };

/**
 * Valida uma receita gerada (rendimento 1 porção) contra as metas do slot.
 * Totais SEMPRE do sistema. Feedback textual serve de correção para o Claude.
 */
export function validateGeneratedRecipe(
  targets: MacroTotals,
  items: GeneratedIngredient[],
): GeneratedValidation {
  const totals = computeRecipeTotals(
    items.map((i) => ({ quantityG: i.quantityG, ingredient: i.ingredient })),
    1,
  );
  const fit = fitPortionToTarget(targets, totals);
  if (fit.fits && fit.factor === 1) return { ok: true, totals };

  const lines = [
    `Totais calculados pelo sistema: ${totals.kcal} kcal, ${totals.proteinG} g proteína, ${totals.carbsG} g carboidrato, ${totals.fatG} g gordura.`,
    `Metas da refeição: ${targets.kcal} kcal, ${targets.proteinG} g proteína, ${targets.carbsG} g carboidrato, ${targets.fatG} g gordura.`,
    `Ajuste as QUANTIDADES (gramas) para aproximar as metas (tolerância: kcal ±5%, macros ±10%).`,
  ];
  const issues: string[] = [];
  if (Math.abs(totals.kcal - targets.kcal) > targets.kcal * 0.05) issues.push("calorias fora da tolerância");
  if (targets.proteinG > 0 && totals.proteinG > targets.proteinG * 1.1) issues.push("proteína fora da tolerância");
  if (targets.carbsG > 0 && totals.carbsG > targets.carbsG * 1.1) issues.push("carboidrato fora da tolerância");
  if (targets.fatG > 0 && totals.fatG > targets.fatG * 1.1) issues.push("gordura fora da tolerância");
  return { ok: false, feedback: `${issues.join("; ")}. ${lines.join(" ")}` };
}
