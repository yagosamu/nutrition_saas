import { notFound } from "next/navigation";
import type { MealType } from "@/lib/types";
import { prisma } from "@/server/db";
import { RecipeForm } from "../recipe-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Editar receita
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">{recipe.name}</p>
      <RecipeForm
        id={recipe.id}
        initial={{
          name: recipe.name,
          instructions: recipe.instructions,
          servings: recipe.servings,
          suitableMealTypes: recipe.suitableMealTypes as MealType[],
          ingredients: recipe.ingredients.map((ri) => ({
            ingredientId: ri.ingredientId,
            name: ri.ingredient.name,
            quantityG: ri.quantityG,
            macros: {
              kcalPer100g: ri.ingredient.kcalPer100g,
              proteinGPer100g: ri.ingredient.proteinGPer100g,
              carbsGPer100g: ri.ingredient.carbsGPer100g,
              fatGPer100g: ri.ingredient.fatGPer100g,
            },
          })),
        }}
      />
    </div>
  );
}
