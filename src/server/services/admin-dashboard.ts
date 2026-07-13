import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import { computeAdherence } from "@/lib/nutrition";
import type { AdherenceStats } from "@/lib/types";
import { prisma } from "@/server/db";

export type AdminDashboardView = {
  activePatients: number;
  logsToday: number;
  pendingCuration: number;
  aiCostMonthUsd: number;
  inactiveAlerts: { patientId: string; name: string; daysSince: number | null }[]; // null = nunca registrou
  adherenceByPatient: { patientId: string; name: string; adherence: AdherenceStats }[];
};

export async function getAdminDashboard(): Promise<AdminDashboardView> {
  const todayStart = utcDateFromDateString(todayInSaoPaulo());
  const since7 = new Date(todayStart);
  since7.setUTCDate(since7.getUTCDate() - 6);
  const alertCutoff = new Date(todayStart);
  alertCutoff.setUTCDate(alertCutoff.getUTCDate() - 3);
  const monthStart = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1));

  const [activePatients, logsToday, pendingCuration, monthAgg, patients] = await Promise.all([
    prisma.user.count({ where: { role: "PATIENT", active: true } }),
    prisma.mealLog.count({ where: { date: todayStart } }),
    prisma.recipe.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.aiJob.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { costUsd: true } }),
    prisma.user.findMany({
      where: { role: "PATIENT", active: true },
      select: {
        id: true,
        name: true,
        mealLogs: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
        _count: { select: { mealLogs: { where: { date: { gte: since7 } } } } },
        mealPlans: {
          where: { active: true },
          select: { _count: { select: { slots: true } } },
          take: 1,
        },
      },
    }),
  ]);

  const inactiveAlerts = patients
    .map((p) => {
      const last = p.mealLogs[0]?.date ?? null;
      if (last == null) return { patientId: p.id, name: p.name, daysSince: null };
      if (last >= alertCutoff) return null;
      const daysSince = Math.floor((todayStart.getTime() - last.getTime()) / 86_400_000);
      return { patientId: p.id, name: p.name, daysSince };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const adherenceByPatient = patients
    .map((p) => ({
      patientId: p.id,
      name: p.name,
      adherence: computeAdherence(p.mealPlans[0]?._count.slots ?? 0, 7, p._count.mealLogs),
    }))
    .sort((a, b) => a.adherence.pct - b.adherence.pct);

  return {
    activePatients,
    logsToday,
    pendingCuration,
    aiCostMonthUsd: monthAgg._sum.costUsd ? Number(monthAgg._sum.costUsd) : 0,
    inactiveAlerts,
    adherenceByPatient,
  };
}
