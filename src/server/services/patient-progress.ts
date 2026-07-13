import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import { computeAdherence } from "@/lib/nutrition";
import type { AdherenceStats, TimelineEntry, WeightPoint } from "@/lib/types";
import { prisma } from "@/server/db";

export type PatientProgressView = {
  weights: WeightPoint[]; // ordenado por data asc (para o gráfico)
  currentWeightKg: number | null;
  delta30dKg: number | null; // atual − peso mais antigo dentro de 30 dias
  adherence7: AdherenceStats;
  adherence30: AdherenceStats;
  timeline: TimelineEntry[]; // desc
};

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function adherenceFor(patientId: string, days: number): Promise<AdherenceStats> {
  const todayStart = utcDateFromDateString(todayInSaoPaulo());
  const since = new Date(todayStart);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const [slotsPerDay, logged] = await Promise.all([
    prisma.mealSlot.count({ where: { mealPlan: { patientId, active: true } } }),
    prisma.mealLog.count({ where: { patientId, date: { gte: since } } }),
  ]);
  return computeAdherence(slotsPerDay, days, logged);
}

export async function getPatientProgress(patientId: string): Promise<PatientProgressView> {
  const assessments = await prisma.assessment.findMany({
    where: { patientId },
    orderBy: { date: "asc" },
  });

  const weights: WeightPoint[] = assessments
    .filter((a) => a.weightKg != null)
    .map((a) => ({ date: dateToStr(a.date), weightKg: a.weightKg!, source: a.source }));

  const currentWeightKg = weights.length ? weights[weights.length - 1].weightKg : null;
  const cutoff = new Date(utcDateFromDateString(todayInSaoPaulo()));
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const inWindow = weights.filter((w) => utcDateFromDateString(w.date) >= cutoff);
  const delta30dKg =
    currentWeightKg != null && inWindow.length >= 2
      ? Math.round((currentWeightKg - inWindow[0].weightKg) * 10) / 10
      : null;

  const timeline: TimelineEntry[] = assessments
    .map((a): TimelineEntry => {
      if (a.source === "TEAM") {
        const parts = [
          a.weightKg != null ? `${a.weightKg} kg` : null,
          a.bodyFatPct != null ? `${a.bodyFatPct}% GC` : null,
          a.waistCm != null ? `cintura ${a.waistCm} cm` : null,
        ].filter(Boolean);
        return {
          date: dateToStr(a.date),
          kind: "TEAM_ASSESSMENT",
          weightKg: a.weightKg,
          summary: parts.length ? `Avaliação da equipe · ${parts.join(" · ")}` : "Avaliação da equipe",
        };
      }
      return {
        date: dateToStr(a.date),
        kind: "PATIENT_WEIGHT",
        weightKg: a.weightKg,
        summary: `Peso registrado · ${a.weightKg} kg`,
      };
    })
    .reverse();

  const [adherence7, adherence30] = await Promise.all([adherenceFor(patientId, 7), adherenceFor(patientId, 30)]);

  return { weights, currentWeightKg, delta30dKg, adherence7, adherence30, timeline };
}
