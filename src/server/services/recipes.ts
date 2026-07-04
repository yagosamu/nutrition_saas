import { computeRecipeTotals } from "@/lib/nutrition";
import type { ActionResult, IngredientMacros } from "@/lib/types";
import type { RecipeInputData } from "@/lib/validation/recipe";
import { prisma } from "@/server/db";

export type RecipePersistData = RecipeInputData & {
  id: string | null;
  status: "APPROVED";
  origin: "TEAM";
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
};

export type RecipeDeps = {
  findIngredientMacros: (ids: string[]) => Promise<(IngredientMacros & { id: string })[]>;
  persist: (data: RecipePersistData) => Promise<{ id: string }>;
};

export async function saveTeamRecipeWith(
  deps: RecipeDeps,
  input: RecipeInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  const ids = input.ingredients.map((i) => i.ingredientId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Ingrediente repetido na receita" };
  }

  const macros = await deps.findIngredientMacros(ids);
  const byId = new Map(macros.map((m) => [m.id, m]));
  for (const ingredientId of ids) {
    if (!byId.has(ingredientId)) {
      return { ok: false, error: `Ingrediente não encontrado: ${ingredientId}` };
    }
  }

  const totals = computeRecipeTotals(
    input.ingredients.map((i) => ({ quantityG: i.quantityG, ingredient: byId.get(i.ingredientId)! })),
    input.servings,
  );

  const saved = await deps.persist({
    ...input,
    id,
    status: "APPROVED",
    origin: "TEAM",
    kcalPerServing: totals.kcal,
    proteinGPerServing: totals.proteinG,
    carbsGPerServing: totals.carbsG,
    fatGPerServing: totals.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export function saveTeamRecipe(
  input: RecipeInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  return saveTeamRecipeWith(
    {
      findIngredientMacros: (ids) =>
        prisma.ingredient.findMany({
          where: { id: { in: ids } },
          select: { id: true, kcalPer100g: true, proteinGPer100g: true, carbsGPer100g: true, fatGPer100g: true },
        }),
      persist: async (data) => {
        const recipeFields = {
          name: data.name,
          instructions: data.instructions,
          servings: data.servings,
          suitableMealTypes: data.suitableMealTypes,
          status: data.status,
          origin: data.origin,
          kcalPerServing: data.kcalPerServing,
          proteinGPerServing: data.proteinGPerServing,
          carbsGPerServing: data.carbsGPerServing,
          fatGPerServing: data.fatGPerServing,
        };
        const ingredientRows = data.ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          quantityG: i.quantityG,
        }));
        if (data.id) {
          await prisma.$transaction([
            prisma.recipeIngredient.deleteMany({ where: { recipeId: data.id } }),
            prisma.recipe.update({
              where: { id: data.id },
              data: { ...recipeFields, ingredients: { create: ingredientRows } },
            }),
          ]);
          return { id: data.id };
        }
        const created = await prisma.recipe.create({
          data: { ...recipeFields, ingredients: { create: ingredientRows } },
          select: { id: true },
        });
        return { id: created.id };
      },
    },
    input,
    id,
  );
}
