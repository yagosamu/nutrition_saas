import Link from "next/link";
import { notFound } from "next/navigation";
import type { MealType } from "@/lib/types";
import { prisma } from "@/server/db";
import { PlanEditor, type EditorInitial } from "./plan-editor";

export default async function PatientPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.user.findUnique({
    where: { id, role: "PATIENT" },
    select: { id: true, name: true },
  });
  if (!patient) notFound();

  const plan = await prisma.mealPlan.findFirst({
    where: { patientId: id, active: true },
    include: {
      slots: {
        orderBy: { order: "asc" },
        include: {
          items: {
            include: {
              ingredient: {
                select: {
                  name: true,
                  kcalPer100g: true,
                  proteinGPer100g: true,
                  carbsGPer100g: true,
                  fatGPer100g: true,
                },
              },
              recipe: {
                select: {
                  name: true,
                  kcalPerServing: true,
                  proteinGPerServing: true,
                  carbsGPerServing: true,
                  fatGPerServing: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const initial: EditorInitial | null = plan
    ? {
        dailyKcal: plan.dailyKcal,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
        slots: plan.slots.map((slot) => ({
          id: slot.id,
          name: slot.name,
          mealType: slot.mealType as MealType,
          timeHint: slot.timeHint,
          kcal: slot.kcal,
          proteinG: slot.proteinG,
          carbsG: slot.carbsG,
          fatG: slot.fatG,
          items: slot.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantityG: item.quantityG,
            recipeId: item.recipeId,
            servings: item.servings,
            label: item.ingredient?.name ?? item.recipe?.name ?? "?",
            source: item.ingredient
              ? {
                  kind: "ingredient" as const,
                  macros: {
                    kcalPer100g: item.ingredient.kcalPer100g,
                    proteinGPer100g: item.ingredient.proteinGPer100g,
                    carbsGPer100g: item.ingredient.carbsGPer100g,
                    fatGPer100g: item.ingredient.fatGPer100g,
                  },
                }
              : {
                  kind: "recipe" as const,
                  perServing: {
                    kcal: item.recipe?.kcalPerServing ?? 0,
                    proteinG: item.recipe?.proteinGPerServing ?? 0,
                    carbsG: item.recipe?.carbsGPerServing ?? 0,
                    fatG: item.recipe?.fatGPerServing ?? 0,
                  },
                },
          })),
        })),
      }
    : null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            Plano alimentar
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            <Link
              href={`/admin/patients/${patient.id}`}
              className="hover:text-brand-600"
            >
              {patient.name}
            </Link>
            {initial ? " · editando o plano ativo" : " · novo plano"}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <PlanEditor patientId={patient.id} initial={initial} />
      </div>
    </div>
  );
}
