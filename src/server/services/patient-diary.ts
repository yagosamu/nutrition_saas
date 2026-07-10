import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import { sumMacros } from "@/lib/nutrition";
import type { MacroTotals } from "@/lib/types";
import { prisma } from "@/server/db";

export type DiaryLogView = {
  slotName: string;
  status: "COMPLETED" | "SKIPPED";
  type: string | null;
  freeDescription: string | null;
  notes: string | null;
  consumed: MacroTotals;
  photoKeys: string[];
};

export type DiaryDayView = {
  date: string; // YYYY-MM-DD
  totalKcal: number;
  logs: DiaryLogView[];
  dayNote: string | null;
};

function dateToString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getPatientDiary(
  patientId: string,
  days = 14,
): Promise<DiaryDayView[]> {
  const today = utcDateFromDateString(todayInSaoPaulo());
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [logs, notes] = await Promise.all([
    prisma.mealLog.findMany({
      where: { patientId, date: { gte: since } },
      orderBy: [{ date: "desc" }, { loggedAt: "asc" }],
      include: {
        mealSlot: { select: { name: true, order: true } },
        photos: { select: { r2Key: true } },
      },
    }),
    prisma.diaryNote.findMany({
      where: { patientId, date: { gte: since } },
      select: { date: true, text: true },
    }),
  ]);

  const noteByDate = new Map(notes.map((n) => [dateToString(n.date), n.text]));
  const byDate = new Map<string, DiaryLogView[]>();

  for (const log of logs) {
    const key = dateToString(log.date);
    const list = byDate.get(key) ?? [];
    list.push({
      slotName: log.mealSlot.name,
      status: log.status,
      type: log.type,
      freeDescription: log.freeDescription,
      notes: log.notes,
      consumed: {
        kcal: log.kcal,
        proteinG: log.proteinG,
        carbsG: log.carbsG,
        fatG: log.fatG,
      },
      photoKeys: log.photos.map((p) => p.r2Key),
    });
    byDate.set(key, list);
  }

  // dias com nota mas sem registros também aparecem
  for (const [date] of noteByDate) {
    if (!byDate.has(date)) byDate.set(date, []);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, dayLogs]) => ({
      date,
      totalKcal: sumMacros(
        dayLogs.filter((l) => l.status === "COMPLETED").map((l) => l.consumed),
      ).kcal,
      logs: dayLogs,
      dayNote: noteByDate.get(date) ?? null,
    }));
}
