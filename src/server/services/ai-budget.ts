import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";
import { prisma } from "@/server/db";

export type AiBudgetView = { used: number; limit: number; remaining: number };

export type AiBudgetDeps = {
  getDailyLimit: (patientId: string) => Promise<number>;
  countExpensiveJobsToday: (patientId: string) => Promise<number>;
};

export async function checkAiBudgetWith(
  deps: AiBudgetDeps,
  patientId: string,
): Promise<ActionResult<AiBudgetView>> {
  const [limit, used] = await Promise.all([
    deps.getDailyLimit(patientId),
    deps.countExpensiveJobsToday(patientId),
  ]);
  if (used >= limit) {
    return {
      ok: false,
      error: `Você usou as ${limit} análises de IA de hoje — o limite zera à meia-noite`,
    };
  }
  return { ok: true, data: { used, limit, remaining: limit - used } };
}

function todayRange() {
  const start = utcDateFromDateString(todayInSaoPaulo());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function productionAiBudgetDeps(): AiBudgetDeps {
  return {
    getDailyLimit: async (patientId) => {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId: patientId },
        select: { dailyAiLimit: true },
      });
      return profile?.dailyAiLimit ?? 0;
    },
    countExpensiveJobsToday: async (patientId) => {
      const { start, end } = todayRange();
      return prisma.aiJob.count({
        where: {
          patientId,
          type: { in: ["GENERATE", "EVALUATE_EXTERNAL"] },
          status: { not: "FAILED" },
          createdAt: { gte: start, lt: end },
        },
      });
    },
  };
}

export function getAiBudget(patientId: string) {
  return checkAiBudgetWith(productionAiBudgetDeps(), patientId);
}
