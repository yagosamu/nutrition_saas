import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";
import type { TeamAssessmentData } from "@/lib/validation/assessment";
import { prisma } from "@/server/db";

export type PatientWeightDeps = {
  findTodayPatientAssessment: (patientId: string, dateStr: string) => Promise<{ id: string } | null>;
  createWeight: (data: { patientId: string; date: string; weightKg: number }) => Promise<void>;
  updateWeight: (id: string, weightKg: number) => Promise<void>;
  today: () => string;
};

export async function upsertPatientWeightWith(
  deps: PatientWeightDeps,
  patientId: string,
  weightKg: number,
): Promise<ActionResult> {
  if (!(weightKg > 0)) return { ok: false, error: "Informe um peso válido" };
  const date = deps.today();
  const existing = await deps.findTodayPatientAssessment(patientId, date);
  if (existing) {
    await deps.updateWeight(existing.id, weightKg);
  } else {
    await deps.createWeight({ patientId, date, weightKg });
  }
  return { ok: true, data: undefined };
}

export function upsertPatientWeight(patientId: string, weightKg: number): Promise<ActionResult> {
  return upsertPatientWeightWith(
    {
      findTodayPatientAssessment: (pid, dateStr) =>
        prisma.assessment.findFirst({
          where: { patientId: pid, source: "PATIENT", date: utcDateFromDateString(dateStr) },
          select: { id: true },
        }),
      createWeight: async (data) => {
        await prisma.assessment.create({
          data: {
            patientId: data.patientId,
            source: "PATIENT",
            date: utcDateFromDateString(data.date),
            weightKg: data.weightKg,
          },
        });
      },
      updateWeight: async (id, weightKg) => {
        await prisma.assessment.update({ where: { id }, data: { weightKg } });
      },
      today: () => todayInSaoPaulo(),
    },
    patientId,
    weightKg,
  );
}

export async function createTeamAssessment(
  patientId: string,
  recordedById: string,
  input: TeamAssessmentData,
): Promise<ActionResult<{ id: string }>> {
  const created = await prisma.assessment.create({
    data: {
      patientId,
      source: "TEAM",
      recordedById,
      date: utcDateFromDateString(input.date),
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      chestCm: input.chestCm,
      armCm: input.armCm,
      thighCm: input.thighCm,
      bodyFatPct: input.bodyFatPct,
      muscleMassKg: input.muscleMassKg,
      notes: input.notes,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: created.id } };
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  await prisma.assessment.delete({ where: { id } });
  return { ok: true, data: undefined };
}
