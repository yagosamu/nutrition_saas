import type { AiJobTypeName } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { enqueueAiJob } from "@/server/queue";
import type { AiUsage } from "@/server/ai/anthropic";

export async function createAndEnqueueAiJob(params: {
  type: AiJobTypeName;
  patientId: string;
  input: Prisma.InputJsonValue;
}): Promise<{ id: string }> {
  const job = await prisma.aiJob.create({
    data: { type: params.type, patientId: params.patientId, input: params.input, status: "PENDING" },
    select: { id: true },
  });
  await enqueueAiJob(job.id);
  return job;
}

export async function markJobRunning(id: string): Promise<void> {
  await prisma.aiJob.update({ where: { id }, data: { status: "RUNNING" } });
}

export async function markJobCompleted(
  id: string,
  result: Prisma.InputJsonValue,
  usages: AiUsage[],
): Promise<void> {
  const inputTokens = usages.reduce((s, u) => s + u.inputTokens, 0);
  const outputTokens = usages.reduce((s, u) => s + u.outputTokens, 0);
  const costUsd = usages.reduce((s, u) => s + u.costUsd, 0);
  await prisma.aiJob.update({
    where: { id },
    data: {
      status: "COMPLETED",
      result,
      inputTokens,
      outputTokens,
      costUsd,
      completedAt: new Date(),
      error: null,
    },
  });
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  await prisma.aiJob.update({
    where: { id },
    data: { status: "FAILED", error: error.slice(0, 1000), completedAt: new Date() },
  });
}
