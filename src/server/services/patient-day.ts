import { computeDayBalance, scalePer100, scaleServing, sumMacros } from "@/lib/nutrition";
import { utcDateFromDateString } from "@/lib/dates";
import type { DayBalance, MacroTotals } from "@/lib/types";
import { prisma } from "@/server/db";

export type DaySlotView = {
  slotId: string;
  name: string;
  timeHint: string | null;
  targets: MacroTotals;
  baseTotals: MacroTotals;
  baseItems: { label: string; detail: string; macros: MacroTotals }[];
  log: {
    id: string;
    status: "COMPLETED" | "SKIPPED";
    type: string | null;
    freeDescription: string | null;
    notes: string | null;
    consumed: MacroTotals;
    photoKeys: string[];
  } | null;
};

export type PatientDayView = {
  hasPlan: boolean;
  balance: DayBalance | null;
  slots: DaySlotView[];
  dayNote: string | null;
};

export async function getPatientDay(
  patientId: string,
  dateStr: string,
): Promise<PatientDayView> {
  const date = utcDateFromDateString(dateStr);
  const plan = await prisma.mealPlan.findFirst({
    where: { patientId, active: true },
    include: {
      slots: {
        orderBy: { order: "asc" },
        include: {
          items: { include: { ingredient: true, recipe: true } },
          mealLogs: {
            where: { patientId, date },
            include: { photos: { select: { r2Key: true } } },
          },
        },
      },
    },
  });

  const dayNote = await prisma.diaryNote.findUnique({
    where: { patientId_date: { patientId, date } },
    select: { text: true },
  });

  if (!plan) return { hasPlan: false, balance: null, slots: [], dayNote: dayNote?.text ?? null };

  const slots: DaySlotView[] = plan.slots.map((slot) => {
    const baseItems = slot.items.map((item) => {
      if (item.ingredient) {
        return {
          label: item.ingredient.name,
          detail: `${item.quantityG ?? 0} g`,
          macros: scalePer100(item.ingredient, item.quantityG ?? 0),
        };
      }
      return {
        label: item.recipe?.name ?? "?",
        detail: `${item.servings ?? 0} porção(ões)`,
        macros: scaleServing(
          {
            kcal: item.recipe?.kcalPerServing ?? 0,
            proteinG: item.recipe?.proteinGPerServing ?? 0,
            carbsG: item.recipe?.carbsGPerServing ?? 0,
            fatG: item.recipe?.fatGPerServing ?? 0,
          },
          item.servings ?? 0,
        ),
      };
    });
    const log = slot.mealLogs[0] ?? null;
    return {
      slotId: slot.id,
      name: slot.name,
      timeHint: slot.timeHint,
      targets: { kcal: slot.kcal, proteinG: slot.proteinG, carbsG: slot.carbsG, fatG: slot.fatG },
      baseTotals: sumMacros(baseItems.map((i) => i.macros)),
      baseItems,
      log: log
        ? {
            id: log.id,
            status: log.status,
            type: log.type,
            freeDescription: log.freeDescription,
            notes: log.notes,
            consumed: { kcal: log.kcal, proteinG: log.proteinG, carbsG: log.carbsG, fatG: log.fatG },
            photoKeys: log.photos.map((p) => p.r2Key),
          }
        : null,
    };
  });

  const consumed = slots
    .filter((s) => s.log?.status === "COMPLETED")
    .map((s) => s.log!.consumed);

  return {
    hasPlan: true,
    balance: computeDayBalance(
      {
        kcal: plan.dailyKcal,
        proteinG: plan.dailyProteinG,
        carbsG: plan.dailyCarbsG,
        fatG: plan.dailyFatG,
      },
      consumed,
    ),
    slots,
    dayNote: dayNote?.text ?? null,
  };
}
