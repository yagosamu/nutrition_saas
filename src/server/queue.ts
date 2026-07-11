import { PgBoss } from "pg-boss";

export const AI_QUEUE = "ai-jobs";

const globalForBoss = globalThis as unknown as { boss?: PgBoss; bossStarted?: Promise<PgBoss> };

export function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.bossStarted) {
    const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
    globalForBoss.boss = boss;
    globalForBoss.bossStarted = boss.start().then(async () => {
      await boss.createQueue(AI_QUEUE);
      return boss;
    });
  }
  return globalForBoss.bossStarted;
}

export async function enqueueAiJob(aiJobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send(AI_QUEUE, { aiJobId }, { retryLimit: 2, retryDelay: 15, retryBackoff: true });
}
