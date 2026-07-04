"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { patientCreateSchema, patientUpdateSchema } from "@/lib/validation/patient";
import { requireAdmin } from "@/server/auth/guards";
import { createPatient, resetPatientPassword, updatePatient } from "@/server/services/patients";

export async function createPatientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; tempPassword: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = patientCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    birthDate: formData.get("birthDate") || null,
    sex: formData.get("sex") || null,
    teamNotes: formData.get("teamNotes") || null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const result = await createPatient(parsed.data);
  if (result.ok) revalidatePath("/admin/patients");
  return result;
}

export async function updatePatientAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = patientUpdateSchema.safeParse({
    name: formData.get("name"),
    birthDate: formData.get("birthDate") || null,
    sex: formData.get("sex") || null,
    teamNotes: formData.get("teamNotes") || null,
    dailyAiLimit: formData.get("dailyAiLimit"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const result = await updatePatient(userId, parsed.data);
  if (result.ok) {
    revalidatePath("/admin/patients");
    revalidatePath(`/admin/patients/${userId}`);
  }
  return result;
}

export async function resetPatientPasswordAction(
  userId: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };
  return resetPatientPassword(userId);
}
