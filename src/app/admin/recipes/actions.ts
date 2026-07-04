"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { recipeSchema } from "@/lib/validation/recipe";
import { requireAdmin } from "@/server/auth/guards";
import { saveTeamRecipe } from "@/server/services/recipes";

export async function saveRecipeAction(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = recipeSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await saveTeamRecipe(parsed.data, id);
  if (result.ok) revalidatePath("/admin/recipes");
  return result;
}
