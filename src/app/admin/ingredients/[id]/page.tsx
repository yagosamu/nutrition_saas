import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { IngredientForm } from "../ingredient-form";

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Editar ingrediente
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">{ingredient.name}</p>
      <IngredientForm
        id={ingredient.id}
        initial={{
          name: ingredient.name,
          source: ingredient.source,
          kcalPer100g: ingredient.kcalPer100g,
          proteinGPer100g: ingredient.proteinGPer100g,
          carbsGPer100g: ingredient.carbsGPer100g,
          fatGPer100g: ingredient.fatGPer100g,
          fiberGPer100g: ingredient.fiberGPer100g,
        }}
      />
    </div>
  );
}
