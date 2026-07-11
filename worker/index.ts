import "dotenv/config";
import { PgBoss } from "pg-boss";
import { AI_QUEUE } from "../src/server/queue";
import { prisma } from "../src/server/db";
import { markJobFailed, markJobRunning } from "../src/server/services/ai-jobs";
import { runSuggestJob } from "../src/server/ai/pipelines/suggest";
import { runGenerateJob } from "../src/server/ai/pipelines/generate";
import { runEvaluateJob } from "../src/server/ai/pipelines/evaluate-external";

const RETRY_LIMIT = 2;

async function handle(aiJobId: string): Promise<void> {
  const job = await prisma.aiJob.findUnique({ where: { id: aiJobId } });
  if (!job) throw new Error(`AiJob ${aiJobId} não encontrado`);
  await markJobRunning(job.id);

  switch (job.type) {
    case "SUGGEST":
      return runSuggestJob(job);
    case "GENERATE":
      return runGenerateJob(job);
    case "EVALUATE_EXTERNAL":
      return runEvaluateJob(job);
    default:
      throw new Error(`Tipo de job desconhecido: ${job.type}`);
  }
}

async function main() {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  boss.on("error", console.error);
  await boss.start();
  await boss.createQueue(AI_QUEUE);

  const workOptions = { includeMetadata: true } as const;
  await boss.work<{ aiJobId: string }, void, typeof workOptions>(
    AI_QUEUE,
    workOptions,
    async ([job]) => {
      try {
        await handle(job.data.aiJobId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] job ${job.data.aiJobId} falhou (tentativa ${job.retryCount + 1}):`, message);
        if (job.retryCount >= RETRY_LIMIT) {
          await markJobFailed(job.data.aiJobId, message);
        }
        throw error; // deixa o pg-boss reagendar até o limite
      }
    },
  );

  console.log("[worker] ouvindo a fila de IA…");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
