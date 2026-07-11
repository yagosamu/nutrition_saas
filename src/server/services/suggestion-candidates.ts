import { fitPortionToTarget, type PortionFit } from "@/lib/nutrition";
import type { MacroTotals } from "@/lib/types";

export type CandidateRecipe = {
  id: string;
  name: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
};

export type ScoredCandidate = { recipe: CandidateRecipe; fit: PortionFit };

export function selectCandidates(
  targets: MacroTotals,
  recipes: CandidateRecipe[],
): ScoredCandidate[] {
  return recipes
    .map((recipe) => ({
      recipe,
      fit: fitPortionToTarget(targets, {
        kcal: recipe.kcalPerServing,
        proteinG: recipe.proteinGPerServing,
        carbsG: recipe.carbsGPerServing,
        fatG: recipe.fatGPerServing,
      }),
    }))
    .filter((c) => c.fit.fits);
}
