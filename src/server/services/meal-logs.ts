import { scalePer100, scaleServing, sumMacros } from "@/lib/nutrition";
import { utcDateFromDateString } from "@/lib/dates";
import { todayInSaoPaulo } from "@/lib/dates";
import type { ActionResult, MacroTotals } from "@/lib/types";
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
  type: "PLAN" | "FREE_ENTRY" | null;
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
