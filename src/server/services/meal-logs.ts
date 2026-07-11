import { computeRecipeTotals, scalePer100, scaleServing, sumMacros } from "@/lib/nutrition";
import { utcDateFromDateString } from "@/lib/dates";
import { todayInSaoPaulo } from "@/lib/dates";
import type { ActionResult, ExternalEvaluationResult, MacroTotals } from "@/lib/types";
import { z } from "zod";
import type {
  RegisterFreeMealData,
  RegisterPlanMealData,
  SkipMealData,
} from "@/lib/validation/meal-log";
import { prisma } from "@/server/db";

export type MealLogUpsertData = {
  patientId: string;
  mealSlotId: string;
  date: string; // YYYY-MM-DD
  status: "COMPLETED" | "SKIPPED";
  type: "PLAN" | "FREE_ENTRY" | "AI_SUGGESTION" | "EXTERNAL_RECIPE" | null;
  recipeId?: string | null;
  portionFactor?: number | null;
  freeDescription: string | null;
  notes: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealLogDeps = {
  getSlotForPatient: (
    slotId: string,
    patientId: string,
  ) => Promise<{ slotId: string; baseTotals: MacroTotals } | null>;
  upsertLog: (data: MealLogUpsertData) => Promise<{ id: string }>;
  deleteLog: (patientId: string, slotId: string, date: string) => Promise<boolean>;
  today: () => string;
};

function requireToday(deps: MealLogDeps, date: string): string | null {
  return date === deps.today() ? null : "Só é possível registrar o dia de hoje";
}

async function requireOwnedSlot(deps: MealLogDeps, slotId: string, patientId: string) {
  const slot = await deps.getSlotForPatient(slotId, patientId);
  return slot ?? null;
}

export async function registerPlanMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: RegisterPlanMealData,
): Promise<ActionResult<{ id: string }>> {
  const dateError = requireToday(deps, input.date);
  if (dateError) return { ok: false, error: dateError };

  const slot = await requireOwnedSlot(deps, input.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: input.mealSlotId,
    date: input.date,
    status: "COMPLETED",
    type: "PLAN",
    freeDescription: null,
    notes: input.notes,
    kcal: slot.baseTotals.kcal,
    proteinG: slot.baseTotals.proteinG,
    carbsG: slot.baseTotals.carbsG,
    fatG: slot.baseTotals.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export async function registerFreeMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: RegisterFreeMealData,
): Promise<ActionResult<{ id: string }>> {
  const dateError = requireToday(deps, input.date);
  if (dateError) return { ok: false, error: dateError };

  const slot = await requireOwnedSlot(deps, input.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: input.mealSlotId,
    date: input.date,
    status: "COMPLETED",
    type: "FREE_ENTRY",
    freeDescription: input.description,
    notes: input.notes,
    kcal: input.kcal,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export async function skipMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: SkipMealData,
): Promise<ActionResult<{ id: string }>> {
  const dateError = requireToday(deps, input.date);
  if (dateError) return { ok: false, error: dateError };

  const slot = await requireOwnedSlot(deps, input.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: input.mealSlotId,
    date: input.date,
    status: "SKIPPED",
    type: null,
    freeDescription: null,
    notes: null,
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });
  return { ok: true, data: { id: saved.id } };
}

export async function undoMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: SkipMealData,
): Promise<ActionResult> {
  if (input.date !== deps.today()) {
    return { ok: false, error: "Só é possível editar o dia de hoje" };
  }
  const deleted = await deps.deleteLog(patientId, input.mealSlotId, input.date);
  if (!deleted) return { ok: false, error: "Registro não encontrado" };
  return { ok: true, data: undefined };
}

// ---- deps de produção ----

export function productionMealLogDeps(): MealLogDeps {
  return {
    getSlotForPatient: async (slotId, patientId) => {
      const slot = await prisma.mealSlot.findFirst({
        where: { id: slotId, mealPlan: { patientId, active: true } },
        include: {
          items: {
            include: {
              ingredient: {
                select: {
                  kcalPer100g: true,
                  proteinGPer100g: true,
                  carbsGPer100g: true,
                  fatGPer100g: true,
                },
              },
              recipe: {
                select: {
                  kcalPerServing: true,
                  proteinGPerServing: true,
                  carbsGPerServing: true,
                  fatGPerServing: true,
                },
              },
            },
          },
        },
      });
      if (!slot) return null;
      const baseTotals = sumMacros(
        slot.items.map((item) =>
          item.ingredient
            ? scalePer100(item.ingredient, item.quantityG ?? 0)
            : scaleServing(
                {
                  kcal: item.recipe?.kcalPerServing ?? 0,
                  proteinG: item.recipe?.proteinGPerServing ?? 0,
                  carbsG: item.recipe?.carbsGPerServing ?? 0,
                  fatG: item.recipe?.fatGPerServing ?? 0,
                },
                item.servings ?? 0,
              ),
        ),
      );
      return { slotId: slot.id, baseTotals };
    },
    upsertLog: async (data) => {
      const date = utcDateFromDateString(data.date);
      const log = await prisma.mealLog.upsert({
        where: {
          patientId_date_mealSlotId: {
            patientId: data.patientId,
            date,
            mealSlotId: data.mealSlotId,
          },
        },
        update: {
          status: data.status,
          type: data.type,
          recipeId: data.recipeId ?? null,
          portionFactor: data.portionFactor ?? null,
          freeDescription: data.freeDescription,
          notes: data.notes,
          kcal: data.kcal,
          proteinG: data.proteinG,
          carbsG: data.carbsG,
          fatG: data.fatG,
        },
        create: {
          patientId: data.patientId,
          mealSlotId: data.mealSlotId,
          date,
          status: data.status,
          type: data.type,
          recipeId: data.recipeId ?? null,
          portionFactor: data.portionFactor ?? null,
          freeDescription: data.freeDescription,
          notes: data.notes,
          kcal: data.kcal,
          proteinG: data.proteinG,
          carbsG: data.carbsG,
          fatG: data.fatG,
        },
        select: { id: true },
      });
      return log;
    },
    deleteLog: async (patientId, slotId, dateStr) => {
      const result = await prisma.mealLog.deleteMany({
        where: {
          patientId,
          mealSlotId: slotId,
          date: utcDateFromDateString(dateStr),
        },
      });
      return result.count > 0;
    },
    today: () => todayInSaoPaulo(),
  };
}

export async function saveDiaryNote(patientId: string, date: string, text: string) {
  const day = utcDateFromDateString(date);
  if (text.trim() === "") {
    await prisma.diaryNote.deleteMany({ where: { patientId, date: day } });
    return;
  }
  await prisma.diaryNote.upsert({
    where: { patientId_date: { patientId, date: day } },
    update: { text: text.trim() },
    create: { patientId, date: day, text: text.trim() },
  });
}

export type MealSuggestionSnapshot = {
  id: string;
  mealSlotId: string;
  recipeId: string;
  portionFactor: number;
  macros: MacroTotals;
  dateStr: string;
};

export type SuggestionLookupDeps = {
  getSuggestionForPatient: (
    suggestionId: string,
    patientId: string,
  ) => Promise<MealSuggestionSnapshot | null>;
};

export type RegisterSuggestionMealData = {
  suggestionId: string;
  date: string;
  notes: string | null;
};

export async function registerSuggestionMealWith(
  deps: MealLogDeps,
  lookup: SuggestionLookupDeps,
  patientId: string,
  input: RegisterSuggestionMealData,
): Promise<ActionResult<{ id: string }>> {
  if (input.date !== deps.today()) {
    return { ok: false, error: "Só é possível registrar o dia de hoje" };
  }
  const suggestion = await lookup.getSuggestionForPatient(input.suggestionId, patientId);
  if (!suggestion || suggestion.dateStr !== input.date) {
    return { ok: false, error: "Sugestão não encontrada" };
  }
  const slot = await requireOwnedSlot(deps, suggestion.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: suggestion.mealSlotId,
    date: input.date,
    status: "COMPLETED",
    type: "AI_SUGGESTION",
    recipeId: suggestion.recipeId,
    portionFactor: suggestion.portionFactor,
    freeDescription: null,
    notes: input.notes,
    kcal: suggestion.macros.kcal,
    proteinG: suggestion.macros.proteinG,
    carbsG: suggestion.macros.carbsG,
    fatG: suggestion.macros.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export type ExternalEvaluationSnapshot = ExternalEvaluationResult & { mealSlotId: string };

export type ExternalRecipeCreateData = ExternalEvaluationSnapshot & {
  patientId: string;
};

export type ExternalLookupDeps = {
  getEvaluationForPatient: (
    aiJobId: string,
    patientId: string,
  ) => Promise<ExternalEvaluationSnapshot | null>;
  createExternalRecipe: (data: ExternalRecipeCreateData) => Promise<{ id: string }>;
};

export type RegisterExternalMealData = {
  aiJobId: string;
  date: string;
  notes: string | null;
};

export async function registerExternalMealWith(
  deps: MealLogDeps,
  lookup: ExternalLookupDeps,
  patientId: string,
  input: RegisterExternalMealData,
): Promise<ActionResult<{ id: string }>> {
  if (input.date !== deps.today()) {
    return { ok: false, error: "Só é possível registrar o dia de hoje" };
  }
  const evaluation = await lookup.getEvaluationForPatient(input.aiJobId, patientId);
  if (!evaluation) return { ok: false, error: "Avaliação não encontrada" };
  if (evaluation.verdict === "DOES_NOT_FIT") {
    return { ok: false, error: "Essa receita não cabe nesta refeição" };
  }
  const slot = await requireOwnedSlot(deps, evaluation.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const recipe = await lookup.createExternalRecipe({ ...evaluation, patientId });
  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: evaluation.mealSlotId,
    date: input.date,
    status: "COMPLETED",
    type: "EXTERNAL_RECIPE",
    recipeId: recipe.id,
    portionFactor: evaluation.factor,
    freeDescription: null,
    notes: input.notes,
    kcal: evaluation.macros.kcal,
    proteinG: evaluation.macros.proteinG,
    carbsG: evaluation.macros.carbsG,
    fatG: evaluation.macros.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export function productionSuggestionLookupDeps(): SuggestionLookupDeps {
  return {
    getSuggestionForPatient: async (suggestionId, patientId) => {
      const suggestion = await prisma.mealSuggestion.findFirst({
        where: { id: suggestionId, patientId },
        select: {
          id: true,
          mealSlotId: true,
          recipeId: true,
          portionFactor: true,
          kcal: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          date: true,
        },
      });
      if (!suggestion) return null;
      return {
        id: suggestion.id,
        mealSlotId: suggestion.mealSlotId,
        recipeId: suggestion.recipeId,
        portionFactor: suggestion.portionFactor,
        macros: {
          kcal: suggestion.kcal,
          proteinG: suggestion.proteinG,
          carbsG: suggestion.carbsG,
          fatG: suggestion.fatG,
        },
        dateStr: suggestion.date.toISOString().slice(0, 10),
      };
    },
  };
}

const externalEvaluationSchema = z.object({
  mealSlotId: z.string(),
  verdict: z.enum(["FITS", "FITS_WITH_PORTION", "DOES_NOT_FIT"]),
  factor: z.number(),
  macros: z.object({
    kcal: z.number(),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
  }),
  reason: z.string().nullable(),
  recipeName: z.string(),
  servings: z.number(),
  mappedIngredients: z.array(
    z.object({ ingredientId: z.string(), name: z.string(), quantityG: z.number() }),
  ),
  unmappedIngredients: z.array(z.string()),
});

export function productionExternalLookupDeps(): ExternalLookupDeps {
  return {
    getEvaluationForPatient: async (aiJobId, patientId) => {
      const job = await prisma.aiJob.findFirst({
        where: { id: aiJobId, patientId, type: "EVALUATE_EXTERNAL", status: "COMPLETED" },
        select: { result: true },
      });
      const parsed = externalEvaluationSchema.safeParse(job?.result);
      return parsed.success ? parsed.data : null;
    },
    createExternalRecipe: async (data) => {
      const slot = await prisma.mealSlot.findFirst({
        where: { id: data.mealSlotId, mealPlan: { patientId: data.patientId, active: true } },
        select: { mealType: true },
      });
      if (!slot) throw new Error("Refeição não encontrada no seu plano");

      const ingredients = await prisma.ingredient.findMany({
        where: { id: { in: data.mappedIngredients.map((i) => i.ingredientId) } },
        select: {
          id: true,
          kcalPer100g: true,
          proteinGPer100g: true,
          carbsGPer100g: true,
          fatGPer100g: true,
        },
      });
      const byId = new Map(ingredients.map((i) => [i.id, i]));
      const recipeItems = data.mappedIngredients
        .map((item) => {
          const ingredient = byId.get(item.ingredientId);
          return ingredient ? { quantityG: item.quantityG, ingredient } : null;
        })
        .filter((item): item is { quantityG: number; ingredient: (typeof ingredients)[number] } => item != null);
      if (recipeItems.length === 0) throw new Error("Receita sem ingredientes reconhecidos");

      const totals = computeRecipeTotals(recipeItems, data.servings);
      return prisma.recipe.create({
        data: {
          name: data.recipeName,
          instructions: `Receita externa avaliada pelo paciente. Ingredientes não mapeados: ${
            data.unmappedIngredients.join(", ") || "nenhum"
          }.`,
          servings: data.servings,
          suitableMealTypes: [slot.mealType],
          status: "PENDING_REVIEW",
          origin: "EXTERNAL",
          patientId: data.patientId,
          kcalPerServing: totals.kcal,
          proteinGPerServing: totals.proteinG,
          carbsGPerServing: totals.carbsG,
          fatGPerServing: totals.fatG,
          ingredients: {
            create: data.mappedIngredients.map((item) => ({
              ingredientId: item.ingredientId,
              quantityG: item.quantityG,
            })),
          },
        },
        select: { id: true },
      });
    },
  };
}
