"use server";

import type { ActionResult } from "@/lib/types";
import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import {
  evaluateRequestSchema,
  generateRequestSchema,
  suggestRequestSchema,
} from "@/lib/validation/ai";
import { requirePatient } from "@/server/auth/guards";
import { getAiBudget } from "@/server/services/ai-budget";
import { createAndEnqueueAiJob } from "@/server/services/ai-jobs";
import { SUGGEST_JOBS_PER_SLOT_PER_DAY } from "@/server/ai/config";
import { prisma } from "@/server/db";

async function ownedSlot(slotId: string, patientId: string) {
  return prisma.mealSlot.findFirst({
    where: { id: slotId, mealPlan: { patientId, active: true } },
    select: { id: true },
  });
}

export async function requestSuggestionsAction(payload: unknown): Promise<ActionResult<{ jobId: string | null }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = suggestRequestSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  if (parsed.data.date !== todayInSaoPaulo()) return { ok: false, error: "Só é possível para o dia de hoje" };
  if (!(await ownedSlot(parsed.data.mealSlotId, patient.id))) {
    return { ok: false, error: "Refeição não encontrada no seu plano" };
  }

  const date = utcDateFromDateString(parsed.data.date);

  // Reuso: já existem sugestões e não é "novas sugestões" → nada a fazer
  if (!parsed.data.force) {
    const existing = await prisma.mealSuggestion.count({
      where: { patientId: patient.id, mealSlotId: parsed.data.mealSlotId, date },
    });
    if (existing > 0) return { ok: true, data: { jobId: null } };
  }

  // Guarda anti-abuso do SUGGEST (não conta no dailyAiLimit)
  const { start, end } = { start: date, end: new Date(date.getTime() + 86_400_000) };
  const jobsToday = await prisma.aiJob.count({
    where: {
      patientId: patient.id,
      type: "SUGGEST",
      createdAt: { gte: start, lt: end },
      input: { path: ["mealSlotId"], equals: parsed.data.mealSlotId },
    },
  });
  if (jobsToday >= SUGGEST_JOBS_PER_SLOT_PER_DAY) {
    return { ok: false, error: "Muitas gerações para esta refeição hoje — use as sugestões existentes" };
  }

  const job = await createAndEnqueueAiJob({
    type: "SUGGEST",
    patientId: patient.id,
    input: { mealSlotId: parsed.data.mealSlotId, date: parsed.data.date, force: parsed.data.force },
  });
  return { ok: true, data: { jobId: job.id } };
}

export async function requestGenerationAction(payload: unknown): Promise<ActionResult<{ jobId: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = generateRequestSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  if (parsed.data.date !== todayInSaoPaulo()) return { ok: false, error: "Só é possível para o dia de hoje" };
  if (!(await ownedSlot(parsed.data.mealSlotId, patient.id))) {
    return { ok: false, error: "Refeição não encontrada no seu plano" };
  }

  const budget = await getAiBudget(patient.id);
  if (!budget.ok) return budget;

  const job = await createAndEnqueueAiJob({
    type: "GENERATE",
    patientId: patient.id,
    input: { mealSlotId: parsed.data.mealSlotId, date: parsed.data.date },
  });
  return { ok: true, data: { jobId: job.id } };
}

export async function requestEvaluationAction(payload: unknown): Promise<ActionResult<{ jobId: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = evaluateRequestSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  if (parsed.data.date !== todayInSaoPaulo()) return { ok: false, error: "Só é possível para o dia de hoje" };
  if (!(await ownedSlot(parsed.data.mealSlotId, patient.id))) {
    return { ok: false, error: "Refeição não encontrada no seu plano" };
  }

  const budget = await getAiBudget(patient.id);
  if (!budget.ok) return budget;

  const job = await createAndEnqueueAiJob({
    type: "EVALUATE_EXTERNAL",
    patientId: patient.id,
    input: {
      mealSlotId: parsed.data.mealSlotId,
      date: parsed.data.date,
      text: parsed.data.text,
      url: parsed.data.url,
    },
  });
  return { ok: true, data: { jobId: job.id } };
}
