"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function approveRecipeAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const updated = await prisma.recipe.updateMany({
    where: { id, status: "PENDING_REVIEW" },
    data: { status: "APPROVED" },
  });
  if (updated.count === 0) return { ok: false, error: "Receita não está na fila de curadoria" };

  revalidatePath("/admin/recipes");
  revalidatePath(`/admin/recipes/${id}`);
  return { ok: true, data: undefined };
}

export async function rejectRecipeAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const updated = await prisma.recipe.updateMany({
    where: { id, status: "PENDING_REVIEW" },
    data: { status: "PRIVATE" },
  });
  if (updated.count === 0) return { ok: false, error: "Receita não está na fila de curadoria" };

  revalidatePath("/admin/recipes");
  revalidatePath(`/admin/recipes/${id}`);
  return { ok: true, data: undefined };
}
