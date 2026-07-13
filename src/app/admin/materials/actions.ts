"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { materialLinkSchema } from "@/lib/validation/material";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { createLinkMaterial, deleteMaterial } from "@/server/services/materials";

export async function createMaterialAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = materialLinkSchema.safeParse({
    title: formData.get("title"),
    url: formData.get("url"),
    patientId: formData.get("patientId") || null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  if (parsed.data.patientId) {
    const patient = await prisma.user.findFirst({
      where: { id: parsed.data.patientId, role: "PATIENT" },
      select: { id: true },
    });
    if (!patient) return { ok: false, error: "Paciente não encontrado" };
  }

  const result = await createLinkMaterial(admin.id, parsed.data);
  if (result.ok) revalidatePath("/admin/materials");
  return result;
}

export async function deleteMaterialAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };
  const result = await deleteMaterial(id);
  if (result.ok) revalidatePath("/admin/materials");
  return result;
}
