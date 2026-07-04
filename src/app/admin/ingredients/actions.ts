"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { ingredientSchema } from "@/lib/validation/ingredient";
import { requireAdmin } from "@/server/auth/guards";
import { saveCustomIngredient } from "@/server/services/ingredients";

export async function saveIngredientAction(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    kcalPer100g: formData.get("kcalPer100g"),
    proteinGPer100g: formData.get("proteinGPer100g"),
    carbsGPer100g: formData.get("carbsGPer100g"),
    fatGPer100g: formData.get("fatGPer100g"),
    fiberGPer100g: formData.get("fiberGPer100g") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await saveCustomIngredient(parsed.data, id);
  if (result.ok) revalidatePath("/admin/ingredients");
  return result;
}
