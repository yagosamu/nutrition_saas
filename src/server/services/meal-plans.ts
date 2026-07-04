import type { ActionResult } from "@/lib/types";
import type { MealPlanData, MealSlotData } from "@/lib/validation/meal-plan";
import { prisma } from "@/server/db";

export type SlotDiff = {
  toCreate: MealSlotData[];
  toUpdate: (MealSlotData & { id: string })[];
  toDeleteIds: string[];
};

export function diffSlots(existingIds: string[], incoming: MealSlotData[]): SlotDiff {
  const existing = new Set(existingIds);
  const toUpdate: (MealSlotData & { id: string })[] = [];
  const toCreate: MealSlotData[] = [];

  for (const slot of incoming) {
    if (slot.id) {
      if (!existing.has(slot.id)) throw new Error(`Slot desconhecido: ${slot.id}`);
      toUpdate.push({ ...slot, id: slot.id });
    } else {
      toCreate.push(slot);
    }
  }
  const incomingIds = new Set(incoming.map((s) => s.id).filter(Boolean));
  const toDeleteIds = existingIds.filter((id) => !incomingIds.has(id));
  return { toCreate, toUpdate, toDeleteIds };
}

type PlanTargets = Pick<MealPlanData, "dailyKcal" | "dailyProteinG" | "dailyCarbsG" | "dailyFatG">;

export type MealPlanDeps = {
  getActivePlan: (patientId: string) => Promise<{ id: string; slotIds: string[] } | null>;
  createPlanWithSlots: (patientId: string, plan: MealPlanData) => Promise<{ id: string }>;
  applyPlanUpdate: (planId: string, targets: PlanTargets, diff: SlotDiff) => Promise<void>;
};

export async function saveMealPlanWith(
  deps: MealPlanDeps,
  patientId: string,
  input: MealPlanData,
): Promise<ActionResult<{ id: string }>> {
  const active = await deps.getActivePlan(patientId);

  if (!active) {
    const created = await deps.createPlanWithSlots(patientId, input);
    return { ok: true, data: { id: created.id } };
  }

  let diff: SlotDiff;
  try {
    diff = diffSlots(active.slotIds, input.slots);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Slots inválidos" };
  }

  await deps.applyPlanUpdate(
    active.id,
    {
      dailyKcal: input.dailyKcal,
      dailyProteinG: input.dailyProteinG,
      dailyCarbsG: input.dailyCarbsG,
      dailyFatG: input.dailyFatG,
    },
    diff,
  );
  return { ok: true, data: { id: active.id } };
}

// ---- wrapper de produção ----

function slotFields(s: MealSlotData) {
  return {
    name: s.name,
    order: s.order,
    mealType: s.mealType,
    timeHint: s.timeHint,
    kcal: s.kcal,
    proteinG: s.proteinG,
    carbsG: s.carbsG,
    fatG: s.fatG,
  };
}

function itemRows(s: MealSlotData) {
  return s.items.map((i) => ({
    ingredientId: i.ingredientId,
    quantityG: i.quantityG,
    recipeId: i.recipeId,
    servings: i.servings,
  }));
}

export function saveMealPlan(patientId: string, input: MealPlanData) {
  return saveMealPlanWith(
    {
      getActivePlan: async (pid) => {
        const p = await prisma.mealPlan.findFirst({
          where: { patientId: pid, active: true },
          select: { id: true, slots: { select: { id: true } } },
        });
        return p ? { id: p.id, slotIds: p.slots.map((s) => s.id) } : null;
      },
      createPlanWithSlots: async (pid, plan) => {
        const created = await prisma.mealPlan.create({
          data: {
            patientId: pid,
            active: true,
            dailyKcal: plan.dailyKcal,
            dailyProteinG: plan.dailyProteinG,
            dailyCarbsG: plan.dailyCarbsG,
            dailyFatG: plan.dailyFatG,
            slots: {
              create: plan.slots.map((s) => ({ ...slotFields(s), items: { create: itemRows(s) } })),
            },
          },
          select: { id: true },
        });
        return created;
      },
      applyPlanUpdate: async (planId, targets, diff) => {
        await prisma.$transaction([
          prisma.mealPlan.update({ where: { id: planId }, data: targets }),
          ...diff.toDeleteIds.map((id) => prisma.mealSlot.delete({ where: { id } })),
          ...diff.toUpdate.map((s) =>
            prisma.mealSlot.update({
              where: { id: s.id },
              data: { ...slotFields(s), items: { deleteMany: {}, create: itemRows(s) } },
            }),
          ),
          ...diff.toCreate.map((s) =>
            prisma.mealSlot.create({
              data: { ...slotFields(s), mealPlanId: planId, items: { create: itemRows(s) } },
            }),
          ),
        ]);
      },
    },
    patientId,
    input,
  );
}
