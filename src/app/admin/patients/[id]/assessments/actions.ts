"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { teamAssessmentSchema } from "@/lib/validation/assessment";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { createTeamAssessment, deleteAssessment } from "@/server/services/assessments";

function nullableField(formData: FormData, name: string) {
  return formData.get(name) || null;
}

export async function createAssessmentAction(
  patientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const patient = await prisma.user.findFirst({
    where: { id: patientId, role: "PATIENT" },
    select: { id: true },
  });
  if (!patient) return { ok: false, error: "Paciente não encontrado" };

  const parsed = teamAssessmentSchema.safeParse({
    date: formData.get("date"),
    weightKg: nullableField(formData, "weightKg"),
    heightCm: nullableField(formData, "heightCm"),
    waistCm: nullableField(formData, "waistCm"),
    hipCm: nullableField(formData, "hipCm"),
    chestCm: nullableField(formData, "chestCm"),
    armCm: nullableField(formData, "armCm"),
    thighCm: nullableField(formData, "thighCm"),
    bodyFatPct: nullableField(formData, "bodyFatPct"),
    muscleMassKg: nullableField(formData, "muscleMassKg"),
    notes: nullableField(formData, "notes"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const result = await createTeamAssessment(patient.id, admin.id, parsed.data);
  if (result.ok) revalidatePath(`/admin/patients/${patient.id}/assessments`);
  return result;
}

export async function deleteAssessmentAction(id: string, patientId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };
  await deleteAssessment(id);
  revalidatePath(`/admin/patients/${patientId}/assessments`);
  return { ok: true, data: undefined };
}
