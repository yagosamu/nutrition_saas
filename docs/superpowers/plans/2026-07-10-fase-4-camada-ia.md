# Fase 4 (Camada de IA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O coração do produto: worker + fila pg-boss com `AiJob` como porta única de IA; sugestões de refeição (pré-filtro SQL + escala determinística + ranqueamento Claude); geração de receita nova com loop de validação; avaliação de receita externa (texto/link) com veredito e ressalvas; curadoria no admin; limites de custo, prompt caching e auditoria de tokens/custo.

**Architecture:** **A IA nunca calcula nutrição** — toda saída de LLM é JSON estruturado (structured outputs validados por Zod) contendo apenas IDs de ingredientes/receitas e quantidades; macros são sempre calculados por `src/lib/nutrition.ts`. Toda chamada de IA nasce como linha em `AiJob` (fila + auditoria + contador de limite), é enfileirada no pg-boss (sobre o Postgres existente) e executada pelo worker (`worker/index.ts`, processo Node separado). A UI enfileira e faz polling do status — nenhuma request HTTP espera o Claude.

**Tech Stack:** `@anthropic-ai/sdk` (structured outputs via `messages.parse` + `zodOutputFormat`), `pg-boss`, Prisma 7, Zod v4, Vitest. Modelos (decisão do design doc, config centralizada): `claude-sonnet-5` para ranqueamento/geração, `claude-haiku-4-5` para extração/mapeamento.

**Executores:** `[CLAUDE]` = frontend/contratos (especificação precisa + código dos trechos críticos). `[CODEX]` = backend (tarefas autocontidas; TDD sem pular passos; em caso de dúvida sobre a API do pg-boss, consultar o README em `node_modules/pg-boss/` antes de improvisar).

**Pré-requisito (usuário) — necessário a partir da Task 3:** chave da API da Anthropic:
1. Criar em [console.anthropic.com](https://console.anthropic.com) → API Keys.
2. Adicionar ao `.env` (e placeholder no `.env.example`): `ANTHROPIC_API_KEY="sk-ant-..."`.

**Como rodar em dev a partir desta fase:** dois processos — `npm run dev` (web) e `npm run worker` (worker de IA) em terminais separados.

**Decisões de escopo desta fase (não reabrir durante execução):**
- Tolerâncias (design doc): kcal ±5%, cada macro ±10% (relativas à meta; macro com meta 0 é ignorada). Fator de porção em passos de 0,25 no intervalo [0,5, 2].
- Orçamento: só `GENERATE` e `EVALUATE_EXTERNAL` contam no `dailyAiLimit`; jobs `FAILED` não contam. `SUGGEST` é grátis para o paciente, com guarda de 5 jobs por slot/dia.
- Sugestões são substituídas ao pedir "novas sugestões" (replace por slot+data); trocar entre as 3 opções nunca chama IA.
- Receita gerada/externa nasce `status: PENDING_REVIEW` + `patientId` preenchido (vale para o paciente; entra na curadoria). Aprovar → `APPROVED` (mantém `patientId` como proveniência); rejeitar → `PRIVATE` (fica só na história do paciente).
- Retry: pg-boss `retryLimit: 2` com backoff; falha definitiva marca o `AiJob` como `FAILED` e a UI oferece "tentar de novo" (novo job).
- Fetch de link: timeout 10 s, resposta limitada a 1 MB, texto extraído por remoção de tags (sem headless browser no MVP).

---

### Task 1: Contratos da Fase 4 — [CLAUDE]

**Files:**
- Create: `src/lib/validation/ai.ts`
- Modify: `src/lib/types.ts` (tipos de resultado de IA)

- [ ] **Step 1: Adicionar ao final de `src/lib/types.ts`**

```ts
export const AI_JOB_TYPES = ["SUGGEST", "GENERATE", "EVALUATE_EXTERNAL"] as const;
export type AiJobTypeName = (typeof AI_JOB_TYPES)[number];

export type AiJobStatusName = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type ExternalVerdictKind = "FITS" | "FITS_WITH_PORTION" | "DOES_NOT_FIT";

// Resultado persistido em AiJob.result para EVALUATE_EXTERNAL
export type ExternalEvaluationResult = {
  verdict: ExternalVerdictKind;
  factor: number; // fator de porção que melhor aproxima a meta
  macros: MacroTotals; // macros na porção ajustada (fator aplicado)
  reason: string | null; // por que não cabe (quando DOES_NOT_FIT)
  recipeName: string;
  servings: number;
  mappedIngredients: { ingredientId: string; name: string; quantityG: number }[];
  unmappedIngredients: string[]; // ressalvas — não entram na soma
};

// Resultado persistido em AiJob.result para SUGGEST
export type SuggestResult = { suggestionCount: number };

// Resultado persistido em AiJob.result para GENERATE
export type GenerateResult = { recipeId: string; suggestionId: string };

export type AiJobStatusView = {
  id: string;
  type: AiJobTypeName;
  status: AiJobStatusName;
  error: string | null;
  result: unknown;
};
```

- [ ] **Step 2: Criar `src/lib/validation/ai.ts`**

```ts
import { z } from "zod";
import { dateStringSchema } from "./meal-log";

export const suggestRequestSchema = z.object({
  mealSlotId: z.string().min(1),
  date: dateStringSchema,
  force: z.coerce.boolean().default(false), // true = "novas sugestões" (substitui)
});

export const generateRequestSchema = z.object({
  mealSlotId: z.string().min(1),
  date: dateStringSchema,
});

export const evaluateRequestSchema = z
  .object({
    mealSlotId: z.string().min(1),
    date: dateStringSchema,
    text: z.string().trim().max(20000).nullable(),
    url: z.url("Link inválido").nullable(),
  })
  .refine((i) => (i.text != null && i.text.length > 0) !== (i.url != null), {
    message: "Envie o texto da receita OU um link (um dos dois)",
  });

export const registerSuggestionSchema = z.object({
  suggestionId: z.string().min(1),
  date: dateStringSchema,
  notes: z.string().trim().max(1000).nullable(),
});

export const registerExternalSchema = z.object({
  aiJobId: z.string().min(1),
  date: dateStringSchema,
  notes: z.string().trim().max(1000).nullable(),
});

export type SuggestRequestData = z.infer<typeof suggestRequestSchema>;
export type GenerateRequestData = z.infer<typeof generateRequestSchema>;
export type EvaluateRequestData = z.infer<typeof evaluateRequestSchema>;
```

- [ ] **Step 3: Verificar e commitar**

Run: `npm run build` → verde.

```bash
git add src/lib/types.ts src/lib/validation/ai.ts
git commit -m "feat: contratos da fase 4 (requests e resultados de IA)"
```

---

### Task 2: Ajuste determinístico de porção (TDD) — [CODEX]

A matemática que garante que NENHUMA sugestão estoura meta. Vive em `src/lib/nutrition.ts` (puro, sem imports de servidor). **Não alterar nada existente — só adicionar ao final (arquivo e testes).**

**Files:**
- Modify: `src/lib/nutrition.ts`
- Modify: `src/lib/nutrition.test.ts`

- [ ] **Step 1: Adicionar testes ao FINAL de `src/lib/nutrition.test.ts` (falhando)**

```ts
import { fitPortionToTarget, computeExternalVerdict, TOLERANCES } from "./nutrition";

describe("fitPortionToTarget", () => {
  const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

  it("encontra fator em passos de 0,25 que cabe na tolerância", () => {
    const perServing = { kcal: 516, proteinG: 38.4, carbsG: 41.6, fatG: 14.4 };
    const fit = fitPortionToTarget(targets, perServing);
    // 650/516 = 1.26 → 1.25; kcal 645 (dentro de ±5%), macros dentro de ±10%
    expect(fit.factor).toBe(1.25);
    expect(fit.fits).toBe(true);
    expect(fit.macros.kcal).toBe(645);
  });

  it("clampa o fator ao intervalo [0.5, 2]", () => {
    const tiny = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 3 };
    const fit = fitPortionToTarget(targets, tiny);
    expect(fit.factor).toBe(2);
    expect(fit.fits).toBe(false); // 200 kcal está longe de 650
  });

  it("macro com meta 0 é ignorada na checagem", () => {
    const zeroCarbTarget = { kcal: 400, proteinG: 30, carbsG: 0, fatG: 15 };
    const perServing = { kcal: 400, proteinG: 30, carbsG: 12, fatG: 15 };
    expect(fitPortionToTarget(zeroCarbTarget, perServing).fits).toBe(true);
  });

  it("kcal por porção <= 0 não cabe", () => {
    const fit = fitPortionToTarget(targets, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    expect(fit.fits).toBe(false);
  });
});

describe("computeExternalVerdict", () => {
  const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

  it("FITS quando cabe praticamente inteira (fator ~1)", () => {
    const v = computeExternalVerdict(targets, { kcal: 640, proteinG: 44, carbsG: 68, fatG: 21 });
    expect(v.verdict).toBe("FITS");
    expect(v.factor).toBe(1);
  });

  it("FITS_WITH_PORTION quando cabe com fator diferente de 1", () => {
    const v = computeExternalVerdict(targets, { kcal: 860, proteinG: 60, carbsG: 92, fatG: 26 });
    expect(v.verdict).toBe("FITS_WITH_PORTION");
    expect(v.factor).toBe(0.75);
  });

  it("DOES_NOT_FIT com o motivo do macro que estoura", () => {
    // gordura desproporcional: em nenhum fator os dois cabem
    const v = computeExternalVerdict(targets, { kcal: 650, proteinG: 10, carbsG: 20, fatG: 55 });
    expect(v.verdict).toBe("DOES_NOT_FIT");
    expect(v.reason).toContain("gordura");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/nutrition.test.ts` → FAIL.

- [ ] **Step 3: Implementar ao FINAL de `src/lib/nutrition.ts`**

```ts
// Tolerâncias do produto (design doc): kcal ±5%, macros ±10% (relativas à meta).
export const TOLERANCES = { kcalPct: 0.05, macroPct: 0.1 } as const;

export type PortionFit = {
  factor: number;
  macros: MacroTotals;
  fits: boolean;
};

function withinTolerance(value: number, target: number, pct: number): boolean {
  if (target <= 0) return true; // meta 0 = não avaliada
  return Math.abs(value - target) <= target * pct;
}

function fitsTargets(macros: MacroTotals, targets: MacroTotals): boolean {
  return (
    withinTolerance(macros.kcal, targets.kcal, TOLERANCES.kcalPct) &&
    withinTolerance(macros.proteinG, targets.proteinG, TOLERANCES.macroPct) &&
    withinTolerance(macros.carbsG, targets.carbsG, TOLERANCES.macroPct) &&
    withinTolerance(macros.fatG, targets.fatG, TOLERANCES.macroPct)
  );
}

/**
 * Encontra o fator de porção (passos de 0,25 em [0,5, 2]) que melhor aproxima
 * a meta de kcal e verifica as tolerâncias. Determinístico — nunca LLM.
 */
export function fitPortionToTarget(
  targets: MacroTotals,
  perServing: MacroTotals,
): PortionFit {
  if (perServing.kcal <= 0 || targets.kcal <= 0) {
    return { factor: 1, macros: scaleServing(perServing, 1), fits: false };
  }
  const raw = targets.kcal / perServing.kcal;
  const clamped = Math.min(2, Math.max(0.5, raw));
  const factor = Math.round(clamped * 4) / 4;
  const macros = scaleServing(perServing, factor);
  return { factor, macros, fits: fitsTargets(macros, targets) };
}

export type ExternalVerdict = {
  verdict: "FITS" | "FITS_WITH_PORTION" | "DOES_NOT_FIT";
  factor: number;
  macros: MacroTotals;
  reason: string | null;
};

const MACRO_LABELS: [keyof MacroTotals, string][] = [
  ["kcal", "as calorias"],
  ["proteinG", "a proteína"],
  ["carbsG", "o carboidrato"],
  ["fatG", "a gordura"],
];

export function computeExternalVerdict(
  targets: MacroTotals,
  perServing: MacroTotals,
): ExternalVerdict {
  const fit = fitPortionToTarget(targets, perServing);
  if (fit.fits) {
    return {
      verdict: fit.factor === 1 ? "FITS" : "FITS_WITH_PORTION",
      factor: fit.factor,
      macros: fit.macros,
      reason: null,
    };
  }
  const pct = (key: keyof MacroTotals) =>
    key === "kcal" ? TOLERANCES.kcalPct : TOLERANCES.macroPct;
  const offender = MACRO_LABELS.find(
    ([key]) => !withinTolerance(fit.macros[key], targets[key], pct(key)),
  );
  const label = offender?.[1] ?? "as metas";
  const over = offender ? fit.macros[offender[0]] > targets[offender[0]] : true;
  return {
    verdict: "DOES_NOT_FIT",
    factor: fit.factor,
    macros: fit.macros,
    reason: `Mesmo na melhor porção, ${label} fica${over ? "m acima" : "m abaixo"} da meta desta refeição`,
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm run test` → todos (existentes + 7 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition.ts src/lib/nutrition.test.ts
git commit -m "feat: ajuste deterministico de porcao e veredito externo (TDD)"
```

**Critérios de aceite (Codex):** testes passam; nenhuma função/teste existente alterado; arquivo continua puro (sem imports de servidor); nenhum valor nutricional inventado — só aritmética.

---

### Task 3: Infra de IA — pg-boss, worker e cliente Anthropic — [CODEX]

**Pré-requisito:** `ANTHROPIC_API_KEY` no `.env`. Se ausente, PARE e reporte.

**Files:**
- Create: `src/server/ai/config.ts`
- Create: `src/server/ai/anthropic.ts`
- Create: `src/server/queue.ts`
- Create: `worker/index.ts`
- Create: `src/server/services/ai-jobs.ts`
- Modify: `package.json` (script `worker`), `.env.example`

- [ ] **Step 1: Instalar dependências**

```powershell
npm install @anthropic-ai/sdk pg-boss
```

- [ ] **Step 2: Criar `src/server/ai/config.ts`** (ÚNICO lugar com nomes de modelo e preços)

```ts
// Modelos por tarefa (design doc): Sonnet ranqueia/gera; Haiku extrai/mapeia.
export const AI_MODELS = {
  ranking: "claude-sonnet-5",
  generation: "claude-sonnet-5",
  extraction: "claude-haiku-4-5",
} as const;

// USD por milhão de tokens (console.anthropic.com/pricing, jul/2026)
export const MODEL_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING_USD_PER_MTOK[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export const SUGGEST_JOBS_PER_SLOT_PER_DAY = 5;
export const GENERATION_MAX_ATTEMPTS = 3; // 1 tentativa + 2 correções
```

- [ ] **Step 3: Criar `src/server/ai/anthropic.ts`** (wrapper único — captura de usage/custo em toda chamada)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { estimateCostUsd } from "./config";

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

function client(): Anthropic {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic(); // lê ANTHROPIC_API_KEY do env
  }
  return globalForAnthropic.anthropic;
}

export type AiUsage = { model: string; inputTokens: number; outputTokens: number; costUsd: number };

export type StructuredCallParams<T extends z.ZodType> = {
  model: string;
  /** Blocos estáveis primeiro (recebem cache_control), voláteis depois. */
  system: { text: string; cache?: boolean }[];
  userContent: string;
  schema: T;
  maxTokens?: number;
};

/**
 * Chamada estruturada: o Claude responde JSON validado contra o schema Zod.
 * A saída NUNCA contém valores nutricionais — só IDs e quantidades.
 */
export async function runStructured<T extends z.ZodType>(
  params: StructuredCallParams<T>,
): Promise<{ data: z.infer<T>; usage: AiUsage }> {
  const response = await client().messages.parse({
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system.map((block) => ({
      type: "text" as const,
      text: block.text,
      ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
    })),
    messages: [{ role: "user", content: params.userContent }],
    output_config: { format: zodOutputFormat(params.schema) },
  });

  if (response.parsed_output == null) {
    throw new Error(`Resposta da IA não seguiu o formato esperado (stop: ${response.stop_reason})`);
  }

  const inputTokens =
    response.usage.input_tokens +
    (response.usage.cache_creation_input_tokens ?? 0) +
    (response.usage.cache_read_input_tokens ?? 0);
  const usage: AiUsage = {
    model: params.model,
    inputTokens,
    outputTokens: response.usage.output_tokens,
    costUsd: estimateCostUsd(params.model, inputTokens, response.usage.output_tokens),
  };
  return { data: response.parsed_output, usage };
}
```

- [ ] **Step 4: Criar `src/server/queue.ts`**

```ts
import PgBoss from "pg-boss";

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
```

(Se a API do pg-boss instalado divergir — v10 mudou assinaturas —, consultar `node_modules/pg-boss/README.md` e ajustar mantendo: fila nomeada, retryLimit 2 com backoff.)

- [ ] **Step 5: Criar `src/server/services/ai-jobs.ts`** (ciclo de vida do AiJob)

```ts
import type { AiJobTypeName } from "@/lib/types";
import { prisma } from "@/server/db";
import { enqueueAiJob } from "@/server/queue";
import type { AiUsage } from "@/server/ai/anthropic";

export async function createAndEnqueueAiJob(params: {
  type: AiJobTypeName;
  patientId: string;
  input: Record<string, unknown>;
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
  result: Record<string, unknown>,
  usages: AiUsage[],
): Promise<void> {
  const inputTokens = usages.reduce((s, u) => s + u.inputTokens, 0);
  const outputTokens = usages.reduce((s, u) => s + u.outputTokens, 0);
  const costUsd = usages.reduce((s, u) => s + u.costUsd, 0);
  await prisma.aiJob.update({
    where: { id },
    data: { status: "COMPLETED", result, inputTokens, outputTokens, costUsd, completedAt: new Date(), error: null },
  });
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  await prisma.aiJob.update({
    where: { id },
    data: { status: "FAILED", error: error.slice(0, 1000), completedAt: new Date() },
  });
}
```

- [ ] **Step 6: Criar `worker/index.ts`** (esqueleto — os handlers chegam nas Tasks 5–7)

```ts
import "dotenv/config";
import PgBoss from "pg-boss";
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
  await boss.start();
  await boss.createQueue(AI_QUEUE);

  await boss.work<{ aiJobId: string }>(
    AI_QUEUE,
    { includeMetadata: true },
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
```

(Nesta task, criar os três arquivos de pipeline como stubs que lançam `new Error("pipeline ainda não implementado")` — as Tasks 5–7 os preenchem. Verificar `includeMetadata`/`retryCount` contra o README do pg-boss instalado.)

- [ ] **Step 7: Script e env**

`package.json` scripts: `"worker": "tsx --env-file=.env worker/index.ts"`.
`.env.example`: adicionar `ANTHROPIC_API_KEY=""` com comentário.

- [ ] **Step 8: Verificar e commitar**

Run: `npm run test` e `npm run build` → verdes. `npm run worker` → imprime "ouvindo a fila" e mantém o processo (encerrar com Ctrl+C).

```bash
git add src/server/ai src/server/queue.ts src/server/services/ai-jobs.ts worker package.json package-lock.json .env.example
git commit -m "feat: infra de IA - pg-boss, worker e cliente anthropic com custo"
```

**Critérios de aceite (Codex):** worker sobe e conecta; toda chamada de IA passa por `runStructured` (usage+custo sempre capturados); modelos/preços só em `config.ts`; retry com backoff e falha definitiva vira `FAILED`; `ANTHROPIC_API_KEY` nunca chega ao client/browser.

---

### Task 4: Orçamento de IA (TDD) + actions de enfileirar + rota de status — [CODEX]

**Files:**
- Create: `src/server/services/ai-budget.ts` + Test: `src/server/services/ai-budget.test.ts`
- Create: `src/app/app/ai-actions.ts`
- Create: `src/app/api/app/ai-jobs/[id]/route.ts`

- [ ] **Step 1: Testes do orçamento (falhando)**

`src/server/services/ai-budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkAiBudgetWith, type AiBudgetDeps } from "./ai-budget";

function makeDeps(used: number, limit = 10): AiBudgetDeps {
  return {
    getDailyLimit: async () => limit,
    countExpensiveJobsToday: async () => used,
  };
}

describe("checkAiBudgetWith", () => {
  it("permite quando há saldo", async () => {
    const r = await checkAiBudgetWith(makeDeps(3), "p1");
    expect(r).toEqual({ ok: true, data: { used: 3, limit: 10, remaining: 7 } });
  });

  it("bloqueia no limite com mensagem clara", async () => {
    const r = await checkAiBudgetWith(makeDeps(10), "p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("limite");
  });

  it("limite 0 bloqueia sempre", async () => {
    const r = await checkAiBudgetWith(makeDeps(0, 0), "p1");
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `src/server/services/ai-budget.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Criar `src/app/app/ai-actions.ts`**

Regras por action (todas: `requirePatient()`; validar com o schema; validar slot contra o plano ativo do paciente com o MESMO padrão de `getSlotForPatient`/`meal-logs`; `date` deve ser hoje):

```ts
"use server";

import type { ActionResult } from "@/lib/types";
import { todayInSaoPaulo } from "@/lib/dates";
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
import { utcDateFromDateString } from "@/lib/dates";

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
  if (!(await ownedSlot(parsed.data.mealSlotId, patient.id))) return { ok: false, error: "Refeição não encontrada no seu plano" };

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
    where: { patientId: patient.id, type: "SUGGEST", createdAt: { gte: start, lt: end },
      input: { path: ["mealSlotId"], equals: parsed.data.mealSlotId } },
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
  if (!(await ownedSlot(parsed.data.mealSlotId, patient.id))) return { ok: false, error: "Refeição não encontrada no seu plano" };

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
  if (!(await ownedSlot(parsed.data.mealSlotId, patient.id))) return { ok: false, error: "Refeição não encontrada no seu plano" };

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
```

- [ ] **Step 6: Criar `src/app/api/app/ai-jobs/[id]/route.ts`** (polling; posse obrigatória)

```ts
import { NextResponse } from "next/server";
import { requirePatient } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const patient = await requirePatient();
  if (!patient) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const job = await prisma.aiJob.findFirst({
    where: { id, patientId: patient.id },
    select: { id: true, type: true, status: true, error: true, result: true },
  });
  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(job);
}
```

- [ ] **Step 7: Verificar e commitar**

Run: `npm run test` e `npm run build` → verdes.

```bash
git add src/server/services/ai-budget.ts src/server/services/ai-budget.test.ts src/app/app/ai-actions.ts src/app/api/app/ai-jobs
git commit -m "feat: orcamento de IA, actions de enfileirar e rota de status (TDD)"
```

**Critérios de aceite (Codex):** testes passam; GENERATE/EVALUATE bloqueiam no limite com a mensagem amigável; SUGGEST reutiliza sugestões existentes sem job; rota de status nunca vaza job de outro paciente (404); toda action revalida posse do slot e "hoje".

---

### Task 5: Pipeline SUGGEST — [CODEX]

**Files:**
- Create: `src/server/ai/pipelines/suggest.ts` (substituir o stub)
- Test: `src/server/services/suggestion-candidates.test.ts`
- Create: `src/server/services/suggestion-candidates.ts`

- [ ] **Step 1: Testes da seleção de candidatas (falhando)** — parte pura: filtrar receitas que cabem.

```ts
import { describe, expect, it } from "vitest";
import { selectCandidates, type CandidateRecipe } from "./suggestion-candidates";

const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

function recipe(id: string, kcal: number, p: number, c: number, f: number): CandidateRecipe {
  return { id, name: id, kcalPerServing: kcal, proteinGPerServing: p, carbsGPerServing: c, fatGPerServing: f };
}

describe("selectCandidates", () => {
  it("mantém só receitas que cabem em algum fator e devolve o fit", () => {
    const fits = recipe("cabe", 516, 38.4, 41.6, 14.4); // 1.25x = 645 kcal ok
    const tooFat = recipe("gorda", 650, 10, 20, 55);
    const result = selectCandidates(targets, [fits, tooFat]);
    expect(result.map((r) => r.recipe.id)).toEqual(["cabe"]);
    expect(result[0].fit.factor).toBe(1.25);
  });

  it("lista vazia devolve vazio", () => {
    expect(selectCandidates(targets, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Ver falhar; implementar `src/server/services/suggestion-candidates.ts`**

```ts
import { fitPortionToTarget, type PortionFit } from "@/lib/nutrition";
import type { MacroTotals } from "@/lib/types";

export type CandidateRecipe = {
  id: string;
  name: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
};

export type ScoredCandidate = { recipe: CandidateRecipe; fit: PortionFit };

export function selectCandidates(
  targets: MacroTotals,
  recipes: CandidateRecipe[],
): ScoredCandidate[] {
  return recipes
    .map((recipe) => ({
      recipe,
      fit: fitPortionToTarget(targets, {
        kcal: recipe.kcalPerServing,
        proteinG: recipe.proteinGPerServing,
        carbsG: recipe.carbsGPerServing,
        fatG: recipe.fatGPerServing,
      }),
    }))
    .filter((c) => c.fit.fits);
}
```

- [ ] **Step 3: Ver passar; implementar `src/server/ai/pipelines/suggest.ts`**

```ts
import { z } from "zod";
import { utcDateFromDateString } from "@/lib/dates";
import type { AiJob } from "../../../generated/prisma/client";
import { prisma } from "@/server/db";
import { AI_MODELS } from "../config";
import { runStructured, type AiUsage } from "../anthropic";
import { markJobCompleted } from "@/server/services/ai-jobs";
import { selectCandidates } from "@/server/services/suggestion-candidates";

const RANKING_SYSTEM = `Você é a assistente de nutrição de uma consultoria brasileira.
Sua única tarefa: escolher, entre as receitas candidatas fornecidas, as 3 melhores opções para a refeição do paciente, priorizando:
1. Variedade em relação ao que o paciente já comeu hoje e às sugestões recentes.
2. Adequação cultural e praticidade para o tipo de refeição.
Regras invioláveis:
- Escolha APENAS ids presentes na lista de candidatas (todas já couberam nas metas — não avalie números).
- NUNCA invente valores nutricionais nem comente números.
- Se houver menos de 3 candidatas, selecione todas.`;

const rankingSchema = z.object({
  selections: z.array(z.object({ recipeId: z.string() })).max(3),
});

const inputSchema = z.object({
  mealSlotId: z.string(),
  date: z.string(),
  force: z.boolean().optional(),
});

export async function runSuggestJob(job: AiJob): Promise<void> {
  const input = inputSchema.parse(job.input);
  const date = utcDateFromDateString(input.date);

  const slot = await prisma.mealSlot.findFirst({
    where: { id: input.mealSlotId, mealPlan: { patientId: job.patientId, active: true } },
  });
  if (!slot) throw new Error("Slot não pertence ao plano ativo do paciente");

  const targets = { kcal: slot.kcal, proteinG: slot.proteinG, carbsG: slot.carbsG, fatG: slot.fatG };

  // 1. Pré-filtro SQL: aprovadas, do tipo certo, com kcal
  const recipes = await prisma.recipe.findMany({
    where: { status: "APPROVED", suitableMealTypes: { has: slot.mealType }, kcalPerServing: { gt: 0 } },
    select: {
      id: true, name: true,
      kcalPerServing: true, proteinGPerServing: true, carbsGPerServing: true, fatGPerServing: true,
    },
  });

  // 2. Escala determinística — o sistema decide o que cabe
  const candidates = selectCandidates(targets, recipes);
  if (candidates.length === 0) {
    await markJobCompleted(job.id, { suggestionCount: 0 }, []);
    return;
  }

  // 3. Contexto do dia (variedade)
  const [logsToday, recentSuggestions] = await Promise.all([
    prisma.mealLog.findMany({
      where: { patientId: job.patientId, date },
      select: { freeDescription: true, recipe: { select: { name: true } } },
    }),
    prisma.mealSuggestion.findMany({
      where: { patientId: job.patientId, date: { gte: new Date(date.getTime() - 3 * 86_400_000) } },
      select: { recipe: { select: { name: true } } },
      take: 20,
    }),
  ]);

  const usages: AiUsage[] = [];
  let selectedIds: string[];

  if (candidates.length <= 3) {
    selectedIds = candidates.map((c) => c.recipe.id);
  } else {
    // 4. Claude só ranqueia — nunca calcula
    const { data, usage } = await runStructured({
      model: AI_MODELS.ranking,
      system: [{ text: RANKING_SYSTEM, cache: true }],
      userContent: JSON.stringify({
        tipoRefeicao: slot.mealType,
        nomeRefeicao: slot.name,
        candidatas: candidates.map((c) => ({ id: c.recipe.id, nome: c.recipe.name })),
        pacienteJaComeuHoje: logsToday.map((l) => l.recipe?.name ?? l.freeDescription).filter(Boolean),
        sugestoesRecentes: recentSuggestions.map((s) => s.recipe.name),
      }),
      schema: rankingSchema,
    });
    usages.push(usage);
    const valid = new Set(candidates.map((c) => c.recipe.id));
    selectedIds = data.selections.map((s) => s.recipeId).filter((id) => valid.has(id));
    if (selectedIds.length === 0) selectedIds = candidates.slice(0, 3).map((c) => c.recipe.id);
  }

  // 5. Persistir substituindo as sugestões do slot+dia (snapshot calculado pelo sistema)
  const byId = new Map(candidates.map((c) => [c.recipe.id, c]));
  const rows = selectedIds.slice(0, 3).map((id) => {
    const c = byId.get(id)!;
    return {
      patientId: job.patientId,
      mealSlotId: slot.id,
      date,
      recipeId: id,
      portionFactor: c.fit.factor,
      kcal: c.fit.macros.kcal,
      proteinG: c.fit.macros.proteinG,
      carbsG: c.fit.macros.carbsG,
      fatG: c.fit.macros.fatG,
      aiJobId: job.id,
    };
  });

  await prisma.$transaction([
    prisma.mealSuggestion.deleteMany({ where: { patientId: job.patientId, mealSlotId: slot.id, date } }),
    prisma.mealSuggestion.createMany({ data: rows }),
  ]);

  await markJobCompleted(job.id, { suggestionCount: rows.length }, usages);
}
```

- [ ] **Step 4: Verificar e commitar**

Run: `npm run test` e `npm run build` → verdes.

```bash
git add src/server/ai/pipelines/suggest.ts src/server/services/suggestion-candidates.ts src/server/services/suggestion-candidates.test.ts
git commit -m "feat: pipeline de sugestoes - filtro deterministico + ranking claude (TDD)"
```

**Critérios de aceite (Codex):** testes passam; o Claude recebe SÓ nomes/ids (nenhum número nutricional para "avaliar"); ids fora da lista são descartados; snapshot da sugestão vem de `fitPortionToTarget`; substituição é transacional; 0 candidatas termina COMPLETED com `suggestionCount: 0`.

---

### Task 6: Pipeline GENERATE — [CODEX]

**Files:**
- Create: `src/server/ai/pipelines/generate.ts` (substituir o stub)
- Create: `src/server/services/generated-recipe.ts` + Test: `src/server/services/generated-recipe.test.ts`

- [ ] **Step 1: Testes da validação (falhando)** — a parte que garante a tolerância.

```ts
import { describe, expect, it } from "vitest";
import { validateGeneratedRecipe } from "./generated-recipe";

const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };
const arroz = { id: "i-arroz", kcalPer100g: 124, proteinGPer100g: 2.6, carbsGPer100g: 25.8, fatGPer100g: 1 };
const frango = { id: "i-frango", kcalPer100g: 159, proteinGPer100g: 32, carbsGPer100g: 0, fatGPer100g: 2.5 };

describe("validateGeneratedRecipe", () => {
  it("aceita receita dentro da tolerância e devolve totais do sistema", () => {
    const r = validateGeneratedRecipe(targets, [
      { ingredient: arroz, quantityG: 260 },
      { ingredient: frango, quantityG: 190 },
    ]);
    // ~625 kcal, ~67g P... proteína estoura +10%? 67 > 49.5 → não cabe → este exemplo DEVE falhar
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.feedback).toContain("proteína");
  });

  it("dá feedback acionável com os totais calculados", () => {
    const r = validateGeneratedRecipe(targets, [{ ingredient: arroz, quantityG: 100 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.feedback).toContain("124"); // kcal calculada aparece no feedback
      expect(r.feedback).toContain("650"); // meta aparece no feedback
    }
  });

  it("aceita composição equilibrada", () => {
    // 350g arroz (434 kcal, 9.1P, 90.3C, 3.5G) + 110g frango (175 kcal, 35.2P, 0C, 2.8G)
    // total 609 kcal… kcal -6% estoura ±5% → ajustar quantidades p/ caber:
    const r = validateGeneratedRecipe(targets, [
      { ingredient: arroz, quantityG: 365 },
      { ingredient: frango, quantityG: 120 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totals.kcal).toBeGreaterThan(617); // dentro de ±5% de 650
  });
});
```

(⚠️ Codex: confira a aritmética dos casos com `computeRecipeTotals` antes de fixar os asserts — o espírito é: 1 caso que estoura macro, 1 caso de feedback com números, 1 caso que cabe. Ajuste gramaturas se necessário SEM afrouxar tolerâncias.)

- [ ] **Step 2: Ver falhar; implementar `src/server/services/generated-recipe.ts`**

```ts
import { computeRecipeTotals, fitPortionToTarget } from "@/lib/nutrition";
import type { IngredientMacros, MacroTotals } from "@/lib/types";

export type GeneratedIngredient = {
  ingredient: IngredientMacros & { id: string };
  quantityG: number;
};

export type GeneratedValidation =
  | { ok: true; totals: MacroTotals }
  | { ok: false; feedback: string };

/**
 * Valida uma receita gerada (rendimento 1 porção) contra as metas do slot.
 * Totais SEMPRE do sistema. Feedback textual serve de correção para o Claude.
 */
export function validateGeneratedRecipe(
  targets: MacroTotals,
  items: GeneratedIngredient[],
): GeneratedValidation {
  const totals = computeRecipeTotals(
    items.map((i) => ({ quantityG: i.quantityG, ingredient: i.ingredient })),
    1,
  );
  const fit = fitPortionToTarget(targets, totals);
  if (fit.fits && fit.factor === 1) return { ok: true, totals };

  const lines = [
    `Totais calculados pelo sistema: ${totals.kcal} kcal, ${totals.proteinG} g proteína, ${totals.carbsG} g carboidrato, ${totals.fatG} g gordura.`,
    `Metas da refeição: ${targets.kcal} kcal, ${targets.proteinG} g proteína, ${targets.carbsG} g carboidrato, ${targets.fatG} g gordura.`,
    `Ajuste as QUANTIDADES (gramas) para aproximar as metas (tolerância: kcal ±5%, macros ±10%).`,
  ];
  const issues: string[] = [];
  if (Math.abs(totals.kcal - targets.kcal) > targets.kcal * 0.05) issues.push("calorias fora da tolerância");
  if (targets.proteinG > 0 && Math.abs(totals.proteinG - targets.proteinG) > targets.proteinG * 0.1) issues.push("proteína fora da tolerância");
  if (targets.carbsG > 0 && Math.abs(totals.carbsG - targets.carbsG) > targets.carbsG * 0.1) issues.push("carboidrato fora da tolerância");
  if (targets.fatG > 0 && Math.abs(totals.fatG - targets.fatG) > targets.fatG * 0.1) issues.push("gordura fora da tolerância");
  return { ok: false, feedback: `${issues.join("; ")}. ${lines.join(" ")}` };
}
```

- [ ] **Step 3: Ver passar; implementar `src/server/ai/pipelines/generate.ts`**

Estrutura (código completo no arquivo — seguir este fluxo à risca):

```ts
import { z } from "zod";
import { utcDateFromDateString } from "@/lib/dates";
import type { AiJob } from "../../../generated/prisma/client";
import { prisma } from "@/server/db";
import { AI_MODELS, GENERATION_MAX_ATTEMPTS } from "../config";
import { runStructured, type AiUsage } from "../anthropic";
import { markJobCompleted } from "@/server/services/ai-jobs";
import { validateGeneratedRecipe } from "@/server/services/generated-recipe";

const GENERATION_SYSTEM = `Você cria receitas brasileiras práticas para uma consultoria de nutrição.
Regras invioláveis:
- Use APENAS ingredientes do catálogo fornecido, referenciando pelo id exato.
- Especifique quantidades em gramas. Rendimento: exatamente 1 porção.
- NUNCA escreva valores nutricionais — o sistema calcula tudo.
- Receita realista: 3 a 8 ingredientes, modo de preparo claro em português, nome apetitoso.
- Aproxime as metas de kcal/macros da refeição usando as quantidades.`;

const generationSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  ingredients: z.array(z.object({ ingredientId: z.string(), quantityG: z.number() })).min(3).max(8),
});
```

Fluxo do `runGenerateJob(job)`:
1. Parse do input (`mealSlotId`, `date`); carregar slot com posse (como no SUGGEST); metas do slot.
2. Catálogo: `prisma.ingredient.findMany` (todos; `select` id, name, kcalPer100g, proteinGPer100g, carbsGPer100g, fatGPer100g) → bloco de sistema **cacheado**: `{ text: "Catálogo de ingredientes (por 100 g):\n" + JSON.stringify(catalogo), cache: true }` (estável entre jobs → prompt caching efetivo).
3. Loop de até `GENERATION_MAX_ATTEMPTS`: `runStructured` (model `AI_MODELS.generation`, system = [GENERATION_SYSTEM (cache), catálogo (cache)], userContent = metas + o que o paciente já comeu hoje + feedback da tentativa anterior se houver, schema `generationSchema`); resolver os `ingredientId` contra o catálogo (id desconhecido → feedback "id X não existe" e nova tentativa); `validateGeneratedRecipe`; se `ok: false`, usar `feedback` na próxima tentativa. Acumular `usages`.
4. Se nenhuma tentativa coube → `throw new Error("Não consegui gerar uma receita dentro das suas metas — tente de novo")` (vira FAILED com retry/botão).
5. Sucesso: transação — criar `Recipe` (`status: "PENDING_REVIEW"`, `origin: "AI_GENERATED"`, `patientId: job.patientId`, `servings: 1`, `suitableMealTypes: [slot.mealType]`, totais do sistema) com `ingredients.create`; substituir a `MealSuggestion` do slot+dia por UMA sugestão da receita nova (`portionFactor: 1`, snapshot = totais) — regra: geração é resposta a "o banco não tem opção".
6. `markJobCompleted(job.id, { recipeId, suggestionId }, usages)`.

- [ ] **Step 4: Verificar e commitar**

```bash
git add src/server/ai/pipelines/generate.ts src/server/services/generated-recipe.ts src/server/services/generated-recipe.test.ts
git commit -m "feat: pipeline de geracao de receita com loop de validacao (TDD)"
```

**Critérios de aceite (Codex):** testes passam; totais persistidos vêm de `computeRecipeTotals` (nunca do payload da IA); loop para em 3 tentativas; receita nasce PENDING_REVIEW com patientId; catálogo em bloco cacheado; ids desconhecidos geram retry, não crash.

---

### Task 7: Pipeline EVALUATE_EXTERNAL — [CODEX]

**Files:**
- Create: `src/server/ai/pipelines/evaluate-external.ts` (substituir o stub)
- Create: `src/server/services/external-text.ts` + Test: `src/server/services/external-text.test.ts`

- [ ] **Step 1: Testes do extrator de texto de página (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { htmlToText } from "./external-text";

describe("htmlToText", () => {
  it("remove tags, scripts e estilos e colapsa espaços", () => {
    const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
      <body><h1>Bolo  de banana</h1><p>2 bananas</p><p>100g de aveia</p></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Bolo de banana");
    expect(text).toContain("100g de aveia");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });

  it("limita o tamanho da saída", () => {
    const html = `<p>${"x".repeat(50000)}</p>`;
    expect(htmlToText(html).length).toBeLessThanOrEqual(15000);
  });
});
```

- [ ] **Step 2: Ver falhar; implementar `src/server/services/external-text.ts`**

```ts
const MAX_TEXT_LENGTH = 15000;

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export async function fetchRecipePage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; NutriApp/1.0)" },
    });
    if (!res.ok) throw new Error(`A página respondeu ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Página sem conteúdo");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 1_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString("utf-8");
    const text = htmlToText(html);
    if (text.length < 100) throw new Error("Não consegui ler a receita nesse link — cole o texto direto");
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("O site demorou demais para responder — cole o texto da receita");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 3: Ver passar; implementar `src/server/ai/pipelines/evaluate-external.ts`**

Fluxo do `runEvaluateJob(job)` (Haiku nas duas chamadas — extração e mapeamento):

```ts
const EXTRACTION_SYSTEM = `Você extrai ingredientes de receitas em português.
Do texto fornecido, extraia: nome da receita, rendimento em porções (estime se ausente; mínimo 1)
e a lista de ingredientes com quantidade em GRAMAS (converta xícaras/colheres/unidades usando
equivalências brasileiras comuns; estime com bom senso quando impreciso).
NUNCA escreva valores nutricionais (kcal/macros) — apenas nomes e gramas.`;

const extractionSchema = z.object({
  recipeName: z.string(),
  servings: z.number().min(1),
  ingredients: z.array(z.object({ name: z.string(), quantityG: z.number() })).min(1).max(30),
});

const MAPPING_SYSTEM = `Você mapeia nomes de ingredientes para um catálogo de tabela nutricional brasileira (TACO).
Para cada ingrediente extraído, escolha o candidato do catálogo que melhor corresponde ao alimento
COMO ELE É USADO na receita (cru/cozido/grelhado importa). Se nenhum candidato for uma correspondência
razoável, responda null para aquele item. NUNCA escolha por aproximação forçada.`;

const mappingSchema = z.object({
  mappings: z.array(z.object({ extractedName: z.string(), ingredientId: z.string().nullable() })),
});
```

1. Parse input (`mealSlotId`, `date`, `text | url`); slot com posse; metas.
2. Texto: `input.text` ou `fetchRecipePage(input.url)`.
3. **Extração** (Haiku, `EXTRACTION_SYSTEM` cacheado, userContent = texto): → `{recipeName, servings, ingredients[]}`.
4. **Candidatos por nome** (SQL, não LLM): para cada nome extraído, buscar até 6 ingredientes por palavra: quebrar o nome em palavras com 3+ letras e fazer `prisma.ingredient.findMany({ where: { OR: palavras.map(p => ({ name: { contains: p, mode: "insensitive" } })) }, take: 6, select: { id, name } })`.
5. **Mapeamento** (Haiku, `MAPPING_SYSTEM` cacheado, userContent = JSON de `{extraidos: [{name, candidatos: [{id, nome}]}]}`): → mapeamentos. Validar que cada `ingredientId` retornado estava entre os candidatos daquele item (senão tratar como null).
6. Somar pelo sistema: itens mapeados → carregar macros dos ingredientes → `computeRecipeTotals(itens, servings)` = por porção. Itens sem mapeamento vão para `unmappedIngredients` (NÃO entram na soma).
7. Se NENHUM ingrediente mapeado → `throw new Error("Não reconheci os ingredientes dessa receita — confira o texto")`.
8. `computeExternalVerdict(metas, porPorcao)` → veredito.
9. `markJobCompleted(job.id, resultado, usages)` com `ExternalEvaluationResult` completo (incluir `mappedIngredients` com nome + gramas para o "usar receita" da Task 8 e para a curadoria).

- [ ] **Step 4: Verificar e commitar**

```bash
git add src/server/ai/pipelines/evaluate-external.ts src/server/services/external-text.ts src/server/services/external-text.test.ts
git commit -m "feat: pipeline de avaliacao de receita externa (TDD)"
```

**Critérios de aceite (Codex):** testes passam; extração/mapeamento nunca produzem números nutricionais; mapeamento só aceita ids que estavam nos candidatos; não-mapeados viram ressalva e ficam FORA da soma; fetch com timeout/limite e erros amigáveis; veredito vem de `computeExternalVerdict`.

---

### Task 8: Registro via sugestão e via receita externa (TDD) — [CODEX]

**Files:**
- Modify: `src/server/services/meal-logs.ts` (adicionar ao final)
- Modify: `src/server/services/meal-logs.test.ts` (adicionar ao final)
- Modify: `src/app/app/actions.ts` (2 actions novas)

- [ ] **Step 1: Testes (falhando)** — adicionar ao final do test existente:

```ts
import { registerSuggestionMealWith, registerExternalMealWith, type SuggestionLookupDeps } from "./meal-logs";

describe("registerSuggestionMealWith", () => {
  const suggestion = {
    id: "sug1", mealSlotId: "s1", recipeId: "r1", portionFactor: 1.25,
    macros: { kcal: 645, proteinG: 48, carbsG: 52, fatG: 18 },
    dateStr: TODAY,
  };
  const lookup: SuggestionLookupDeps = { getSuggestionForPatient: async () => suggestion };

  it("congela o snapshot da sugestão (calculado pelo sistema) como AI_SUGGESTION", async () => {
    const { deps, upserts } = makeDeps();
    const result = await registerSuggestionMealWith(deps, lookup, "p1", {
      suggestionId: "sug1", date: TODAY, notes: null,
    });
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({
      type: "AI_SUGGESTION", recipeId: "r1", portionFactor: 1.25, kcal: 645, proteinG: 48,
    });
  });

  it("recusa sugestão de outro paciente/dia", async () => {
    const { deps } = makeDeps();
    const result = await registerSuggestionMealWith(
      deps, { getSuggestionForPatient: async () => null }, "p1",
      { suggestionId: "sug1", date: TODAY, notes: null },
    );
    expect(result).toEqual({ ok: false, error: "Sugestão não encontrada" });
  });
});

describe("registerExternalMealWith", () => {
  it("registra EXTERNAL_RECIPE com os macros do veredito e cria a receita pendente", async () => {
    const { deps, upserts } = makeDeps();
    const created: unknown[] = [];
    const result = await registerExternalMealWith(
      deps,
      {
        getEvaluationForPatient: async () => ({
          mealSlotId: "s1",
          verdict: "FITS_WITH_PORTION", factor: 0.75, reason: null,
          macros: { kcal: 640, proteinG: 44, carbsG: 66, fatG: 19 },
          recipeName: "Bolo fit", servings: 8,
          mappedIngredients: [{ ingredientId: "i1", name: "Aveia", quantityG: 100 }],
          unmappedIngredients: [],
        }),
        createExternalRecipe: async (data) => { created.push(data); return { id: "r-ext" }; },
      },
      "p1",
      { aiJobId: "job1", date: TODAY, notes: null },
    );
    expect(result.ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ type: "EXTERNAL_RECIPE", recipeId: "r-ext", portionFactor: 0.75, kcal: 640 });
  });

  it("recusa quando o veredito é DOES_NOT_FIT", async () => {
    const { deps } = makeDeps();
    const result = await registerExternalMealWith(
      deps,
      {
        getEvaluationForPatient: async () => ({
          mealSlotId: "s1", verdict: "DOES_NOT_FIT", factor: 1,
          reason: "A gordura fica acima da meta desta refeição",
          macros: { kcal: 900, proteinG: 20, carbsG: 80, fatG: 50 },
          recipeName: "X", servings: 1, mappedIngredients: [], unmappedIngredients: [],
        }),
        createExternalRecipe: async () => { throw new Error("não deve criar"); },
      },
      "p1",
      { aiJobId: "job1", date: TODAY, notes: null },
    );
    expect(result.ok).toBe(false);
  });
});
```

(Adaptar `makeDeps` existente conforme necessário SEM alterar os testes já escritos. O `MealLogUpsertData` ganha campos opcionais `recipeId` e `portionFactor` — propagar no upsert de produção.)

- [ ] **Step 2: Ver falhar; implementar ao final de `meal-logs.ts`**

- `MealLogUpsertData`: adicionar `recipeId?: string | null; portionFactor?: number | null;` e propagá-los em `upsertLog` de produção (update+create).
- `SuggestionLookupDeps { getSuggestionForPatient(suggestionId, patientId): Promise<{...} | null> }` — produção: `prisma.mealSuggestion.findFirst({ where: { id, patientId } , include slot? })` devolvendo `mealSlotId`, `recipeId`, `portionFactor`, macros e `dateStr` (converter `date` com `.toISOString().slice(0,10)`).
- `registerSuggestionMealWith(deps, lookup, patientId, input)`: hoje-rule (`input.date === deps.today()`); sugestão existe e `dateStr === input.date` (senão "Sugestão não encontrada"); upsert com `status: COMPLETED, type: "AI_SUGGESTION"`, snapshot = macros da sugestão, `recipeId`, `portionFactor`, `notes`.
- `ExternalLookupDeps { getEvaluationForPatient(aiJobId, patientId): Promise<ExternalEvaluationResult & { mealSlotId: string } | null>; createExternalRecipe(data): Promise<{id: string}> }` — produção: carregar `AiJob` (`findFirst { id, patientId, type: EVALUATE_EXTERNAL, status: COMPLETED }`), parsear `result`+`input`; `createExternalRecipe` cria `Recipe` `status: PENDING_REVIEW, origin: EXTERNAL, patientId, servings, suitableMealTypes: [mealType do slot]` com `ingredients.create` dos mapeados e totais recalculados por `computeRecipeTotals` dos mapeados (consistência: o que está na receita é o que foi somado).
- `registerExternalMealWith(...)`: hoje-rule; avaliação existe; veredito ≠ DOES_NOT_FIT (senão `{ok:false, error:"Essa receita não cabe nesta refeição"}`); criar receita; upsert `type: "EXTERNAL_RECIPE"` com snapshot = `macros` do veredito, `portionFactor = factor`.

- [ ] **Step 3: Actions em `src/app/app/actions.ts`** (mesmo padrão das existentes): `registerSuggestionMealAction(payload)` valida `registerSuggestionSchema`; `registerExternalMealAction(payload)` valida `registerExternalSchema`; ambas `requirePatient` + `revalidateApp()`.

- [ ] **Step 4: Verificar e commitar**

```bash
git add src/server/services/meal-logs.ts src/server/services/meal-logs.test.ts src/app/app/actions.ts
git commit -m "feat: registro de refeicao via sugestao e receita externa (TDD)"
```

**Critérios de aceite (Codex):** testes novos passam E todos os antigos continuam passando sem alteração; snapshots vêm da MealSuggestion/veredito (sistema), nunca do payload; posse validada em sugestão e job; DOES_NOT_FIT não registra.

---

### Task 9: UI — Sugestões de IA no detalhe da refeição — [CLAUDE]

Depende das Tasks 4, 5, 6, 8. Segue o design system (chips, macro rows, shimmer `animate-shimmer`, estados de IA da seção 2.4).

**Files:**
- Create: `src/app/app/meals/[slotId]/use-ai-job.ts` (hook de polling)
- Create: `src/app/app/meals/[slotId]/suggestions-panel.tsx` (client)
- Modify: `src/app/app/meals/[slotId]/page.tsx` (tabs: Dieta base · Sugestões · Receita externa; carregar sugestões + orçamento)

**Especificação:**

- [ ] **Step 1:** Hook `useAiJob(jobId | null)`: `setInterval` de 2 s em `GET /api/app/ai-jobs/[id]` enquanto status ∈ {PENDING, RUNNING}; devolve `{status, result, error}`; ao atingir COMPLETED chama `router.refresh()` e para; cleanup no unmount.
- [ ] **Step 2:** `page.tsx` vira tabs (client wrapper leve ou `searchParams.tab`): aba "Dieta base" = conteúdo atual; aba "Sugestões" = `SuggestionsPanel`; aba "Receita externa" = Task 10. Server component busca: sugestões do slot+hoje (`prisma.mealSuggestion.findMany` include recipe name), orçamento (`getAiBudget`) e passa como props serializáveis.
- [ ] **Step 3:** `SuggestionsPanel`: sem sugestões → CTA "Ver sugestões da nutri·IA" (`requestSuggestionsAction`, shimmer "Gerando sugestões… você pode continuar navegando" via hook). Com sugestões → chips "Sugestão 1..3" (ativa selecionada), card da ativa: nome da receita (Manrope), "{fator} porção para bater sua meta" (formatar ¾/1/1¼…), macro rows (kcal/P/C/G do snapshot), badge "✓ dentro da meta", botão primário "Registrar esta opção" (`registerSuggestionMealAction`), link "Novas sugestões" (`force: true`). `suggestionCount: 0` no resultado → estado vazio com botão "Gerar receita nova com IA" (`requestGenerationAction` — mostra "usa 1 análise do seu limite diário"), shimmer, e ao completar `router.refresh()` (a nova sugestão aparece). FAILED → card de erro com "Tentar de novo". Rodapé: "X de N análises de IA hoje" quando orçamento carregado.
- [ ] **Step 4:** Refeição já registrada: painel mostra o estado registrado (reuso do bloco da Task 8 de Fase 3) em vez dos CTAs.
- [ ] **Step 5:** Verificação com worker rodando: fluxo completo em 390 px. Build verde. Commit: `feat: sugestoes de ia no detalhe da refeicao`

---

### Task 10: UI — Avaliação de receita externa — [CLAUDE]

Depende das Tasks 4, 7, 8.

**Files:**
- Create: `src/app/app/meals/[slotId]/external-panel.tsx` (client)

**Especificação:**

- [ ] **Step 1:** Form: toggle "Colar texto" | "Link" (campo condicional: textarea `maxLength 20000` com contador, ou input url); botão "Analisar" (`requestEvaluationAction`, mostra "usa 1 análise do seu limite diário"); shimmer durante o job (hook da Task 9).
- [ ] **Step 2:** Veredito (resultado COMPLETED, cores da seção 5.6 do design system):
  - `FITS` (verde discreto): "Cabe como está ✓" + macro rows + "Registrar nesta refeição".
  - `FITS_WITH_PORTION` (caramelo): "Cabe comendo {fração} da receita" + macros ajustados + registrar.
  - `DOES_NOT_FIT` (vermelho suave): reason + sem botão de registro + sugestão "peça uma sugestão da IA".
  - Ressalvas: `unmappedIngredients` não vazio → aviso "estimado sem: X, Y (avisamos a equipe)".
- [ ] **Step 3:** "Registrar nesta refeição" → `registerExternalMealAction({aiJobId, date, notes: null})` → refresh (vira registrada; receita entra na curadoria).
- [ ] **Step 4:** FAILED → mensagem do erro (são amigáveis: timeout de link, ingredientes não reconhecidos) + "Tentar de novo". Limite atingido → mensagem do orçamento.
- [ ] **Step 5:** Verificação manual com worker + build. Commit: `feat: avaliacao de receita externa no app do paciente`

---

### Task 11: Admin — Curadoria + consumo de IA — [CLAUDE]

Depende das Tasks 5–7 (receitas PENDING_REVIEW passam a existir).

**Files:**
- Create: `src/app/admin/recipes/curation-actions.ts` (server actions: aprovar/rejeitar)
- Modify: `src/app/admin/recipes/[id]/page.tsx` (barra de curadoria quando PENDING_REVIEW)
- Modify: `src/app/admin/recipes/page.tsx` (chip de atalho "Fila de curadoria (N)")
- Create: `src/app/admin/ai-usage/page.tsx`
- Modify: `src/app/admin/nav-links.tsx` (+ "Consumo de IA")

**Especificação:**

- [ ] **Step 1:** `curation-actions.ts`: `approveRecipeAction(id)` → `requireAdmin`; update `where: { id, status: "PENDING_REVIEW" }` → `status: "APPROVED"`; `rejectRecipeAction(id)` → `status: "PRIVATE"`; ambos `revalidatePath("/admin/recipes")`.
- [ ] **Step 2:** Na página de edição da receita, quando `status === "PENDING_REVIEW"`: banner de curadoria (origem IA/Externa, paciente de origem, data) com botões "Aprovar para o banco" / "Rejeitar (fica só do paciente)" (client component pequeno com confirm + pending). Lista de receitas ganha, acima da tabela, atalho "⏳ Fila de curadoria (N)" que aplica `?status=PENDING_REVIEW`.
- [ ] **Step 3:** `/admin/ai-usage`: cards (jobs hoje, custo do mês em USD, tokens do mês) via `prisma.aiJob.aggregate`; tabela dos últimos 50 jobs: data/hora (SP), paciente (nome via include), tipo (label PT), status (badge), tokens in/out, custo (`$0.0042`); nota de rodapé "custo estimado pelas tabelas de preço da Anthropic".
- [ ] **Step 4:** Verificação manual: aprovar uma receita gerada → aparece nas sugestões futuras (status APPROVED); rejeitar → some da fila. Build verde. Commit: `feat: curadoria de receitas e consumo de ia no admin`

---

### Task 12: Verificação final da Fase 4 — [CLAUDE]

Requer `ANTHROPIC_API_KEY` válida e worker rodando (`npm run worker`). Custo esperado da verificação: centavos de dólar.

- [ ] **Step 1:** `npm run test` e `npm run build` verdes.
- [ ] **Step 2:** Ponta a ponta (paciente de teste, 390 px, worker ativo):
  1. Sugestões no Almoço → job processa → até 3 opções persistidas com fator/macros dentro da tolerância (conferir contra as metas do slot).
  2. Trocar entre opções (zero jobs novos) e registrar uma → saldo desconta o snapshot.
  3. "Novas sugestões" → substitui as 3.
  4. Gerar receita nova → receita PENDING_REVIEW criada + vira sugestão registrável.
  5. Colar receita externa (texto) → veredito coerente; registrar quando cabe.
  6. Limite: baixar `dailyAiLimit` do paciente para 1 no admin → segunda operação cara bloqueia com a mensagem amigável; restaurar depois.
  7. Worker parado → job fica PENDING e a UI segue em "processando" sem travar; religar o worker → completa.
  8. Admin: fila de curadoria aprova/rejeita; `/admin/ai-usage` mostra os jobs com tokens/custo.
- [ ] **Step 3:** Atualizar `PRD.md` (checkboxes Fase 4) e `AGENTS.md` (plano da fase mais recente).
- [ ] **Step 4:** Commit `docs: fase 4 concluida` + `git push`.

---

## Ordem de execução e paralelismo

```
Task 1 (CLAUDE) → Task 2 (CODEX) → Task 3 (CODEX) → Task 4 (CODEX)
                                      └→ Tasks 5, 6, 7 (CODEX, em sequência) → Task 8 (CODEX)
Tasks 9–10 (CLAUDE, após 4–8) → Task 11 (CLAUDE) → Task 12 fecha
```

## Definition of Done da Fase 4

- [ ] `npm run test` e `npm run build` verdes; worker sobe com `npm run worker`.
- [ ] Nenhuma chamada à Anthropic fora de `runStructured`; nenhuma fora de um `AiJob`.
- [ ] Nenhum número nutricional em nenhum schema de saída de LLM — auditável pelos schemas Zod dos pipelines.
- [ ] Sugestão registrada = snapshot de `fitPortionToTarget`; geração validada por `computeRecipeTotals`; externa por `computeExternalVerdict`.
- [ ] Limite diário aplicado com mensagem clara; SUGGEST com guarda própria; custo/tokens por job visíveis no admin.
- [ ] Receitas de IA/externas nascem PENDING_REVIEW e só entram no banco geral via curadoria.
- [ ] UI nunca trava esperando IA: enfileira → shimmer → polling → resultado ou erro com retry.
