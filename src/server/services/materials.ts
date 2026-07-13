import type { ActionResult } from "@/lib/types";
import type { MaterialLinkData } from "@/lib/validation/material";
import { prisma } from "@/server/db";

export function visibleToPatient(
  material: { isGlobal: boolean; assignedPatientIds: string[] },
  patientId: string,
): boolean {
  return material.isGlobal || material.assignedPatientIds.includes(patientId);
}

export async function createLinkMaterial(
  uploadedById: string,
  input: MaterialLinkData,
): Promise<ActionResult<{ id: string }>> {
  const created = await prisma.material.create({
    data: {
      title: input.title,
      type: "LINK",
      url: input.url,
      isGlobal: input.patientId == null,
      uploadedById,
      ...(input.patientId ? { assignments: { create: { patientId: input.patientId } } } : {}),
    },
    select: { id: true },
  });
  return { ok: true, data: { id: created.id } };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  await prisma.material.delete({ where: { id } });
  return { ok: true, data: undefined };
}

/** Materiais que o paciente pode ver: globais + atribuídos a ele. */
export function getPatientMaterials(patientId: string) {
  return prisma.material.findMany({
    where: { OR: [{ isGlobal: true }, { assignments: { some: { patientId } } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, type: true, url: true, createdAt: true },
  });
}
