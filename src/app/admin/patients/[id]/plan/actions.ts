"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { mealPlanSchema } from "@/lib/validation/meal-plan";
import { requireAdmin } from "@/server/auth/guards";
import { saveMealPlan } from "@/server/services/meal-plans";

export async function saveMealPlanAction(
  patientId: string,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = mealPlanSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await saveMealPlan(patientId, parsed.data);
  if (result.ok) revalidatePath(`/admin/patients/${patientId}/plan`);
  return result;
}
