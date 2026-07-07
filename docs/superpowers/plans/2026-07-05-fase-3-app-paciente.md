# Fase 3 (App do Paciente) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O paciente vive o dia no app: tela "Hoje" com saldo de kcal/macros, registro de refeições com snapshot imutável (plano / livre / pulada, edição só no mesmo dia), fotos no R2 com URLs pré-assinadas, observações por refeição/dia, dieta base e diário histórico — tudo já na identidade visual definitiva (design system gerado nesta fase).

**Architecture:** Saldo do dia é serviço puro (`computeDayBalance` em `src/lib/nutrition.ts`) — nunca estado armazenado. Registro de refeição congela snapshot calculado **no servidor** a partir da dieta base (tipo PLAN) ou dos números informados pelo paciente (tipo FREE_ENTRY, provenance marcada). Datas seguem o calendário de São Paulo (`src/lib/dates.ts`); `MealLog.date` guarda meia-noite UTC do dia-calendário SP. Fotos: bucket R2 privado, upload direto do browser com URL pré-assinada de escopo estreito, leitura com URL assinada curta, chaves `patients/{id}/...`, cross-access = 404.

**Tech Stack:** Next.js 16, Prisma 7, Zod v4, Vitest, Tailwind v4 (tokens da marca), Auth.js v5, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2 é S3-compatível).

**Executores:** `[CLAUDE]` = frontend/contratos (executor com contexto; especificação precisa + código dos trechos críticos). `[CODEX]` = backend (tarefas autocontidas: código completo, comandos, critérios de aceite; TDD sem pular passos).

**Fotos adiadas (decisão do usuário, 05/07/2026):** o R2 e todas as fotos do diário (Task 4 + partes marcadas 📸 nas Tasks 8–9) ficam para depois. Toda a Fase 3 é construída e entregue **sem fotos**; a Task 4 e os trechos 📸 são executados quando o bucket estiver pronto — nenhum outro trabalho depende deles. O schema já tem `MealLogPhoto`, então adicionar fotos depois é aditivo, sem migração nem refatoração.

**Pré-requisito (usuário) — SÓ quando for retomar as fotos:** bucket R2 na Cloudflare:
1. Dashboard Cloudflare → R2 → Create bucket → nome `nutrition-media` (região automática).
2. R2 → Manage API Tokens → Create API Token → permissão **Object Read & Write** restrita a esse bucket.
3. Adicionar ao `.env` (e espelhar no `.env.example` com placeholders):
```
R2_ACCOUNT_ID="<account id do painel R2>"
R2_ACCESS_KEY_ID="<access key do token>"
R2_SECRET_ACCESS_KEY="<secret do token>"
R2_BUCKET_NAME="nutrition-media"
```

**Decisões de escopo desta fase (não reabrir durante execução):**
- Tipos de registro nesta fase: `PLAN` (seguiu a dieta base), `FREE_ENTRY` (descrição + estimativa do paciente — provenance explícita) e `SKIPPED`. `AI_SUGGESTION`/`EXTERNAL_RECIPE` chegam na Fase 4.
- Registrar/editar/desfazer só para **o dia corrente** (São Paulo). Dias passados são história congelada.
- Foto só pode ser anexada a um registro existente do dia corrente; limite de 3 fotos por refeição; JPEG/PNG/WebP.
- Bottom nav: Hoje · Diário · Meu plano · Progresso (desabilitado, "Fase 5").
- Fotos de RECEITA (banco de receitas) continuam fora — esta fase só cobre fotos do diário do paciente.

---

### Task 1: Contratos da Fase 3 — [CLAUDE]

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/validation/meal-log.ts`

- [ ] **Step 1: Adicionar ao final de `src/lib/types.ts`**

```ts
export type DayBalance = {
  targets: MacroTotals;
  consumed: MacroTotals;
  remaining: MacroTotals; // pode ser negativo (estourou)
};

export const MEAL_LOG_TYPES = ["PLAN", "FREE_ENTRY"] as const;
export type MealLogTypePhase3 = (typeof MEAL_LOG_TYPES)[number];

export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];
```

- [ ] **Step 2: Criar `src/lib/validation/meal-log.ts`**

```ts
import { z } from "zod";
import { PHOTO_CONTENT_TYPES } from "@/lib/types";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const baseLog = z.object({
  mealSlotId: z.string().min(1),
  date: dateStringSchema,
  notes: z.string().trim().max(1000).nullable(),
});

export const registerPlanMealSchema = baseLog;

export const registerFreeMealSchema = baseLog.extend({
  description: z.string().trim().min(1, "Descreva o que você comeu").max(300),
  kcal: z.coerce.number().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500),
  carbsG: z.coerce.number().min(0).max(800),
  fatG: z.coerce.number().min(0).max(300),
});

export const skipMealSchema = z.object({
  mealSlotId: z.string().min(1),
  date: dateStringSchema,
});

export const diaryNoteSchema = z.object({
  date: dateStringSchema,
  text: z.string().trim().max(2000),
});

export const photoUploadRequestSchema = z.object({
  mealLogId: z.string().min(1),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
});

export const photoAttachSchema = z.object({
  mealLogId: z.string().min(1),
  key: z.string().min(1),
});

export type RegisterPlanMealData = z.infer<typeof registerPlanMealSchema>;
export type RegisterFreeMealData = z.infer<typeof registerFreeMealSchema>;
export type SkipMealData = z.infer<typeof skipMealSchema>;
export type DiaryNoteData = z.infer<typeof diaryNoteSchema>;
```

- [ ] **Step 3: Verificar e commitar**

Run: `npm run build` → Expected: verde.

```bash
git add src/lib/types.ts src/lib/validation/meal-log.ts
git commit -m "feat: contratos da fase 3 (registro de refeicao, diario e fotos)"
```

---

### Task 2: Datas de São Paulo + saldo do dia (TDD) — [CODEX]

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`
- Modify: `src/lib/nutrition.ts` (adicionar `computeDayBalance` ao final)
- Modify: `src/lib/nutrition.test.ts` (adicionar bloco de testes ao final)

- [ ] **Step 1: Escrever `src/lib/dates.test.ts` (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { formatDatePtBr, todayInSaoPaulo, utcDateFromDateString } from "./dates";

describe("todayInSaoPaulo", () => {
  it("converte instante UTC para o dia-calendário de São Paulo", () => {
    // 01:00 UTC de 5/jul = 22:00 de 4/jul em SP (UTC-3)
    expect(todayInSaoPaulo(new Date("2026-07-05T01:00:00Z"))).toBe("2026-07-04");
  });
  it("mantém o dia quando já passou de meia-noite em SP", () => {
    expect(todayInSaoPaulo(new Date("2026-07-05T12:00:00Z"))).toBe("2026-07-05");
  });
});

describe("utcDateFromDateString", () => {
  it("gera meia-noite UTC do dia-calendário (convenção de storage do MealLog.date)", () => {
    expect(utcDateFromDateString("2026-07-04").toISOString()).toBe(
      "2026-07-04T00:00:00.000Z",
    );
  });
});

describe("formatDatePtBr", () => {
  it("formata por extenso em pt-BR", () => {
    const label = formatDatePtBr("2026-07-04");
    expect(label.toLowerCase()).toContain("4 de julho");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/lib/dates.ts`**

```ts
// Datas do produto seguem o calendário de America/Sao_Paulo.
// Convenção de storage: MealLog.date = meia-noite UTC do dia-calendário SP.
const SP_TZ = "America/Sao_Paulo";

export function todayInSaoPaulo(now: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function utcDateFromDateString(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDatePtBr(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC", // a data já é o dia-calendário; UTC evita drift
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(utcDateFromDateString(dateStr));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dates.test.ts` → Expected: 4 passed.

- [ ] **Step 5: Adicionar testes de `computeDayBalance` ao FINAL de `src/lib/nutrition.test.ts`** (não alterar nada existente)

```ts
import { computeDayBalance } from "./nutrition";

describe("computeDayBalance", () => {
  const targets = { kcal: 1800, proteinG: 130, carbsG: 180, fatG: 60 };

  it("soma consumido e calcula restante", () => {
    const balance = computeDayBalance(targets, [
      { kcal: 418, proteinG: 22, carbsG: 51, fatG: 12 },
      { kcal: 645, proteinG: 48, carbsG: 52, fatG: 18 },
    ]);
    expect(balance.consumed).toEqual({ kcal: 1063, proteinG: 70, carbsG: 103, fatG: 30 });
    expect(balance.remaining).toEqual({ kcal: 737, proteinG: 60, carbsG: 77, fatG: 30 });
  });

  it("restante pode ficar negativo (estourou a meta)", () => {
    const balance = computeDayBalance(targets, [
      { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 80 },
    ]);
    expect(balance.remaining.kcal).toBe(-200);
    expect(balance.remaining.fatG).toBe(-20);
  });

  it("dia sem registros devolve as metas inteiras", () => {
    const balance = computeDayBalance(targets, []);
    expect(balance.remaining).toEqual(targets);
    expect(balance.consumed).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});
```

- [ ] **Step 6: Implementar `computeDayBalance` ao FINAL de `src/lib/nutrition.ts`**

```ts
import type { DayBalance } from "./types";

export function computeDayBalance(
  targets: MacroTotals,
  consumedList: MacroTotals[],
): DayBalance {
  const consumed = sumMacros(consumedList);
  return {
    targets,
    consumed,
    remaining: {
      kcal: round1(targets.kcal - consumed.kcal),
      proteinG: round1(targets.proteinG - consumed.proteinG),
      carbsG: round1(targets.carbsG - consumed.carbsG),
      fatG: round1(targets.fatG - consumed.fatG),
    },
  };
}
```

(Ajustar o import de tipos no topo do arquivo para incluir `DayBalance` se preferir — desde que nenhuma função existente mude.)

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npm run test` → Expected: todos passam (existentes + novos).

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/nutrition.ts src/lib/nutrition.test.ts
git commit -m "feat: datas de sao paulo e saldo do dia (TDD)"
```

**Critérios de aceite (Codex):** testes passam; nenhum teste/função existente alterado; `dates.ts` e `nutrition.ts` continuam sem imports de servidor.

---

### Task 3: Guard de paciente + serviço de registro de refeições e diário (TDD) — [CODEX]

O coração da fase: snapshot imutável, regra do dia corrente e posse do slot.

**Files:**
- Modify: `src/server/auth/guards.ts` (adicionar `requirePatient`)
- Create: `src/server/services/meal-logs.ts`
- Test: `src/server/services/meal-logs.test.ts`
- Create: `src/server/services/patient-day.ts` (query de leitura da tela Hoje — sem TDD, código completo abaixo)
- Create: `src/app/app/actions.ts`

- [ ] **Step 1: Adicionar `requirePatient` ao final de `src/server/auth/guards.ts`**

```ts
export async function requirePatient(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "PATIENT") return null;
  return { id: session.user.id };
}
```

- [ ] **Step 2: Escrever `src/server/services/meal-logs.test.ts` (falhando)**

```ts
import { describe, expect, it } from "vitest";
import {
  registerPlanMealWith,
  registerFreeMealWith,
  skipMealWith,
  undoMealWith,
  type MealLogDeps,
} from "./meal-logs";

const TODAY = "2026-07-05";
const baseTotals = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

function makeDeps(overrides?: Partial<MealLogDeps>) {
  const upserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const deps: MealLogDeps = {
    getSlotForPatient: async () => ({ slotId: "s1", baseTotals }),
    upsertLog: async (data) => {
      upserts.push(data as Record<string, unknown>);
      return { id: "log1" };
    },
    deleteLog: async (_patientId, slotId) => {
      deletes.push(slotId);
      return true;
    },
    today: () => TODAY,
    ...overrides,
  };
  return { deps, upserts, deletes };
}

describe("registerPlanMealWith", () => {
  const input = { mealSlotId: "s1", date: TODAY, notes: null };

  it("congela o snapshot da dieta base calculado no servidor", async () => {
    const { deps, upserts } = makeDeps();
    const result = await registerPlanMealWith(deps, "p1", input);
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({
      patientId: "p1",
      mealSlotId: "s1",
      status: "COMPLETED",
      type: "PLAN",
      kcal: 650,
      proteinG: 45,
      carbsG: 70,
      fatG: 20,
    });
  });

  it("recusa data que não é hoje", async () => {
    const { deps } = makeDeps();
    const result = await registerPlanMealWith(deps, "p1", { ...input, date: "2026-07-04" });
    expect(result).toEqual({ ok: false, error: "Só é possível registrar o dia de hoje" });
  });

  it("recusa slot que não pertence ao plano ativo do paciente", async () => {
    const { deps } = makeDeps({ getSlotForPatient: async () => null });
    const result = await registerPlanMealWith(deps, "p1", input);
    expect(result).toEqual({ ok: false, error: "Refeição não encontrada no seu plano" });
  });
});

describe("registerFreeMealWith", () => {
  it("usa os números do paciente e marca FREE_ENTRY", async () => {
    const { deps, upserts } = makeDeps();
    const result = await registerFreeMealWith(deps, "p1", {
      mealSlotId: "s1",
      date: TODAY,
      notes: null,
      description: "Pizza (2 fatias)",
      kcal: 540,
      proteinG: 22,
      carbsG: 60,
      fatG: 24,
    });
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({
      type: "FREE_ENTRY",
      freeDescription: "Pizza (2 fatias)",
      kcal: 540,
    });
  });
});

describe("skipMealWith", () => {
  it("registra SKIPPED com macros zerados", async () => {
    const { deps, upserts } = makeDeps();
    const result = await skipMealWith(deps, "p1", { mealSlotId: "s1", date: TODAY });
    expect(result.ok).toBe(true);
    expect(upserts[0]).toMatchObject({ status: "SKIPPED", kcal: 0, proteinG: 0 });
  });
});

describe("undoMealWith", () => {
  it("desfaz registro de hoje", async () => {
    const { deps, deletes } = makeDeps();
    const result = await undoMealWith(deps, "p1", { mealSlotId: "s1", date: TODAY });
    expect(result.ok).toBe(true);
    expect(deletes).toEqual(["s1"]);
  });

  it("recusa desfazer dia passado", async () => {
    const { deps } = makeDeps();
    const result = await undoMealWith(deps, "p1", { mealSlotId: "s1", date: "2026-07-01" });
    expect(result).toEqual({ ok: false, error: "Só é possível editar o dia de hoje" });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/server/services/meal-logs.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar `src/server/services/meal-logs.ts`**

```ts
import { scalePer100, scaleServing, sumMacros } from "@/lib/nutrition";
import { utcDateFromDateString } from "@/lib/dates";
import { todayInSaoPaulo } from "@/lib/dates";
import type { ActionResult, MacroTotals } from "@/lib/types";
import type {
  RegisterFreeMealData,
  RegisterPlanMealData,
  SkipMealData,
} from "@/lib/validation/meal-log";
import { prisma } from "@/server/db";

export type MealLogUpsertData = {
  patientId: string;
  mealSlotId: string;
  date: string; // YYYY-MM-DD
  status: "COMPLETED" | "SKIPPED";
  type: "PLAN" | "FREE_ENTRY" | null;
  freeDescription: string | null;
  notes: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealLogDeps = {
  getSlotForPatient: (
    slotId: string,
    patientId: string,
  ) => Promise<{ slotId: string; baseTotals: MacroTotals } | null>;
  upsertLog: (data: MealLogUpsertData) => Promise<{ id: string }>;
  deleteLog: (patientId: string, slotId: string, date: string) => Promise<boolean>;
  today: () => string;
};

function requireToday(deps: MealLogDeps, date: string): string | null {
  return date === deps.today() ? null : "Só é possível registrar o dia de hoje";
}

async function requireOwnedSlot(deps: MealLogDeps, slotId: string, patientId: string) {
  const slot = await deps.getSlotForPatient(slotId, patientId);
  return slot ?? null;
}

export async function registerPlanMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: RegisterPlanMealData,
): Promise<ActionResult<{ id: string }>> {
  const dateError = requireToday(deps, input.date);
  if (dateError) return { ok: false, error: dateError };

  const slot = await requireOwnedSlot(deps, input.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: input.mealSlotId,
    date: input.date,
    status: "COMPLETED",
    type: "PLAN",
    freeDescription: null,
    notes: input.notes,
    kcal: slot.baseTotals.kcal,
    proteinG: slot.baseTotals.proteinG,
    carbsG: slot.baseTotals.carbsG,
    fatG: slot.baseTotals.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export async function registerFreeMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: RegisterFreeMealData,
): Promise<ActionResult<{ id: string }>> {
  const dateError = requireToday(deps, input.date);
  if (dateError) return { ok: false, error: dateError };

  const slot = await requireOwnedSlot(deps, input.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: input.mealSlotId,
    date: input.date,
    status: "COMPLETED",
    type: "FREE_ENTRY",
    freeDescription: input.description,
    notes: input.notes,
    kcal: input.kcal,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export async function skipMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: SkipMealData,
): Promise<ActionResult<{ id: string }>> {
  const dateError = requireToday(deps, input.date);
  if (dateError) return { ok: false, error: dateError };

  const slot = await requireOwnedSlot(deps, input.mealSlotId, patientId);
  if (!slot) return { ok: false, error: "Refeição não encontrada no seu plano" };

  const saved = await deps.upsertLog({
    patientId,
    mealSlotId: input.mealSlotId,
    date: input.date,
    status: "SKIPPED",
    type: null,
    freeDescription: null,
    notes: null,
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });
  return { ok: true, data: { id: saved.id } };
}

export async function undoMealWith(
  deps: MealLogDeps,
  patientId: string,
  input: SkipMealData,
): Promise<ActionResult> {
  if (input.date !== deps.today()) {
    return { ok: false, error: "Só é possível editar o dia de hoje" };
  }
  const deleted = await deps.deleteLog(patientId, input.mealSlotId, input.date);
  if (!deleted) return { ok: false, error: "Registro não encontrado" };
  return { ok: true, data: undefined };
}

// ---- deps de produção ----

export function productionMealLogDeps(): MealLogDeps {
  return {
    getSlotForPatient: async (slotId, patientId) => {
      const slot = await prisma.mealSlot.findFirst({
        where: { id: slotId, mealPlan: { patientId, active: true } },
        include: {
          items: {
            include: {
              ingredient: {
                select: {
                  kcalPer100g: true,
                  proteinGPer100g: true,
                  carbsGPer100g: true,
                  fatGPer100g: true,
                },
              },
              recipe: {
                select: {
                  kcalPerServing: true,
                  proteinGPerServing: true,
                  carbsGPerServing: true,
                  fatGPerServing: true,
                },
              },
            },
          },
        },
      });
      if (!slot) return null;
      const baseTotals = sumMacros(
        slot.items.map((item) =>
          item.ingredient
            ? scalePer100(item.ingredient, item.quantityG ?? 0)
            : scaleServing(
                {
                  kcal: item.recipe?.kcalPerServing ?? 0,
                  proteinG: item.recipe?.proteinGPerServing ?? 0,
                  carbsG: item.recipe?.carbsGPerServing ?? 0,
                  fatG: item.recipe?.fatGPerServing ?? 0,
                },
                item.servings ?? 0,
              ),
        ),
      );
      return { slotId: slot.id, baseTotals };
    },
    upsertLog: async (data) => {
      const date = utcDateFromDateString(data.date);
      const log = await prisma.mealLog.upsert({
        where: {
          patientId_date_mealSlotId: {
            patientId: data.patientId,
            date,
            mealSlotId: data.mealSlotId,
          },
        },
        update: {
          status: data.status,
          type: data.type,
          freeDescription: data.freeDescription,
          notes: data.notes,
          kcal: data.kcal,
          proteinG: data.proteinG,
          carbsG: data.carbsG,
          fatG: data.fatG,
        },
        create: {
          patientId: data.patientId,
          mealSlotId: data.mealSlotId,
          date,
          status: data.status,
          type: data.type,
          freeDescription: data.freeDescription,
          notes: data.notes,
          kcal: data.kcal,
          proteinG: data.proteinG,
          carbsG: data.carbsG,
          fatG: data.fatG,
        },
        select: { id: true },
      });
      return log;
    },
    deleteLog: async (patientId, slotId, dateStr) => {
      const result = await prisma.mealLog.deleteMany({
        where: {
          patientId,
          mealSlotId: slotId,
          date: utcDateFromDateString(dateStr),
        },
      });
      return result.count > 0;
    },
    today: () => todayInSaoPaulo(),
  };
}

export async function saveDiaryNote(patientId: string, date: string, text: string) {
  const day = utcDateFromDateString(date);
  if (text.trim() === "") {
    await prisma.diaryNote.deleteMany({ where: { patientId, date: day } });
    return;
  }
  await prisma.diaryNote.upsert({
    where: { patientId_date: { patientId, date: day } },
    update: { text: text.trim() },
    create: { patientId, date: day, text: text.trim() },
  });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/server/services/meal-logs.test.ts` → Expected: 7 passed.

- [ ] **Step 6: Criar `src/server/services/patient-day.ts`** (leitura da tela Hoje/Diário)

```ts
import { computeDayBalance, scalePer100, scaleServing, sumMacros } from "@/lib/nutrition";
import { utcDateFromDateString } from "@/lib/dates";
import type { DayBalance, MacroTotals } from "@/lib/types";
import { prisma } from "@/server/db";

export type DaySlotView = {
  slotId: string;
  name: string;
  timeHint: string | null;
  targets: MacroTotals;
  baseTotals: MacroTotals;
  baseItems: { label: string; detail: string; macros: MacroTotals }[];
  log: {
    id: string;
    status: "COMPLETED" | "SKIPPED";
    type: string | null;
    freeDescription: string | null;
    notes: string | null;
    consumed: MacroTotals;
    photoKeys: string[];
  } | null;
};

export type PatientDayView = {
  hasPlan: boolean;
  balance: DayBalance | null;
  slots: DaySlotView[];
  dayNote: string | null;
};

export async function getPatientDay(
  patientId: string,
  dateStr: string,
): Promise<PatientDayView> {
  const date = utcDateFromDateString(dateStr);
  const plan = await prisma.mealPlan.findFirst({
    where: { patientId, active: true },
    include: {
      slots: {
        orderBy: { order: "asc" },
        include: {
          items: { include: { ingredient: true, recipe: true } },
          mealLogs: {
            where: { patientId, date },
            include: { photos: { select: { r2Key: true } } },
          },
        },
      },
    },
  });

  const dayNote = await prisma.diaryNote.findUnique({
    where: { patientId_date: { patientId, date } },
    select: { text: true },
  });

  if (!plan) return { hasPlan: false, balance: null, slots: [], dayNote: dayNote?.text ?? null };

  const slots: DaySlotView[] = plan.slots.map((slot) => {
    const baseItems = slot.items.map((item) => {
      if (item.ingredient) {
        return {
          label: item.ingredient.name,
          detail: `${item.quantityG ?? 0} g`,
          macros: scalePer100(item.ingredient, item.quantityG ?? 0),
        };
      }
      return {
        label: item.recipe?.name ?? "?",
        detail: `${item.servings ?? 0} porção(ões)`,
        macros: scaleServing(
          {
            kcal: item.recipe?.kcalPerServing ?? 0,
            proteinG: item.recipe?.proteinGPerServing ?? 0,
            carbsG: item.recipe?.carbsGPerServing ?? 0,
            fatG: item.recipe?.fatGPerServing ?? 0,
          },
          item.servings ?? 0,
        ),
      };
    });
    const log = slot.mealLogs[0] ?? null;
    return {
      slotId: slot.id,
      name: slot.name,
      timeHint: slot.timeHint,
      targets: { kcal: slot.kcal, proteinG: slot.proteinG, carbsG: slot.carbsG, fatG: slot.fatG },
      baseTotals: sumMacros(baseItems.map((i) => i.macros)),
      baseItems,
      log: log
        ? {
            id: log.id,
            status: log.status,
            type: log.type,
            freeDescription: log.freeDescription,
            notes: log.notes,
            consumed: { kcal: log.kcal, proteinG: log.proteinG, carbsG: log.carbsG, fatG: log.fatG },
            photoKeys: log.photos.map((p) => p.r2Key),
          }
        : null,
    };
  });

  const consumed = slots
    .filter((s) => s.log?.status === "COMPLETED")
    .map((s) => s.log!.consumed);

  return {
    hasPlan: true,
    balance: computeDayBalance(
      {
        kcal: plan.dailyKcal,
        proteinG: plan.dailyProteinG,
        carbsG: plan.dailyCarbsG,
        fatG: plan.dailyFatG,
      },
      consumed,
    ),
    slots,
    dayNote: dayNote?.text ?? null,
  };
}
```

- [ ] **Step 7: Criar `src/app/app/actions.ts`** (actions do paciente — finas)

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import {
  diaryNoteSchema,
  registerFreeMealSchema,
  registerPlanMealSchema,
  skipMealSchema,
} from "@/lib/validation/meal-log";
import { requirePatient } from "@/server/auth/guards";
import {
  productionMealLogDeps,
  registerFreeMealWith,
  registerPlanMealWith,
  saveDiaryNote,
  skipMealWith,
  undoMealWith,
} from "@/server/services/meal-logs";

function revalidateApp() {
  revalidatePath("/app");
  revalidatePath("/app/diary");
}

export async function registerPlanMealAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = registerPlanMealSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await registerPlanMealWith(productionMealLogDeps(), patient.id, parsed.data);
  if (result.ok) revalidateApp();
  return result;
}

export async function registerFreeMealAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = registerFreeMealSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await registerFreeMealWith(productionMealLogDeps(), patient.id, parsed.data);
  if (result.ok) revalidateApp();
  return result;
}

export async function skipMealAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = skipMealSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await skipMealWith(productionMealLogDeps(), patient.id, parsed.data);
  if (result.ok) revalidateApp();
  return result;
}

export async function undoMealAction(payload: unknown): Promise<ActionResult> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = skipMealSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await undoMealWith(productionMealLogDeps(), patient.id, parsed.data);
  if (result.ok) revalidateApp();
  return result;
}

export async function saveDiaryNoteAction(payload: unknown): Promise<ActionResult> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = diaryNoteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  await saveDiaryNote(patient.id, parsed.data.date, parsed.data.text);
  revalidateApp();
  return { ok: true, data: undefined };
}
```

- [ ] **Step 8: Verificar e commitar**

Run: `npm run test` e `npm run build` → Expected: verdes.

```bash
git add src/server/auth/guards.ts src/server/services/meal-logs.ts src/server/services/meal-logs.test.ts src/server/services/patient-day.ts src/app/app/actions.ts
git commit -m "feat: registro de refeicoes com snapshot imutavel e saldo do dia (TDD)"
```

**Critérios de aceite (Codex):** testes passam; snapshot de PLAN vem SEMPRE do cálculo do servidor sobre a dieta base (nunca do payload); FREE_ENTRY marca provenance; regra do dia corrente em registrar E desfazer; slot validado contra o plano ativo DO paciente da sessão; `MealLog.date` gravado como meia-noite UTC do dia-calendário SP.

---

### Task 4: Storage R2 — fotos do diário (TDD na parte pura) — [CODEX] — ⏸️ ADIADA

> **Não execute agora.** Esta task só roda quando o usuário criar o bucket R2 e preencher as variáveis no `.env` (ver "Fotos adiadas" no topo). As demais tasks da fase são construídas sem ela. Quando retomada, seguem-se os trechos marcados 📸 nas Tasks 8 e 9.

**Pré-requisito:** variáveis R2 no `.env` (ver topo do plano). Se ausentes, PARE e reporte.

**Files:**
- Create: `src/server/storage/r2-keys.ts` (puro — TDD)
- Test: `src/server/storage/r2-keys.test.ts`
- Create: `src/server/storage/r2.ts` (wrapper SDK — fino)
- Create: `src/server/services/meal-photos.ts`
- Create: `src/app/app/photo-actions.ts`
- Modify: `.env.example` (placeholders R2)

- [ ] **Step 1: Instalar SDK**

```powershell
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Escrever `src/server/storage/r2-keys.test.ts` (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { buildMealPhotoKey, extensionFor, keyBelongsToPatient } from "./r2-keys";

describe("extensionFor", () => {
  it("mapeia content-types para extensões", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});

describe("buildMealPhotoKey", () => {
  it("gera chave com namespace do paciente e extensão", () => {
    const key = buildMealPhotoKey("p1", "log1", "image/jpeg");
    expect(key).toMatch(/^patients\/p1\/meal-photos\/log1-[a-z0-9-]+\.jpg$/);
  });
});

describe("keyBelongsToPatient", () => {
  it("aceita chave do próprio paciente", () => {
    expect(keyBelongsToPatient("patients/p1/meal-photos/x.jpg", "p1")).toBe(true);
  });
  it("recusa chave de outro paciente ou fora do namespace", () => {
    expect(keyBelongsToPatient("patients/p2/meal-photos/x.jpg", "p1")).toBe(false);
    expect(keyBelongsToPatient("outra/coisa.jpg", "p1")).toBe(false);
    expect(keyBelongsToPatient("patients/p10/meal-photos/x.jpg", "p1")).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/server/storage/r2-keys.test.ts` → Expected: FAIL.

- [ ] **Step 4: Implementar `src/server/storage/r2-keys.ts`**

```ts
import { randomUUID } from "node:crypto";
import type { PhotoContentType } from "@/lib/types";

const EXTENSIONS: Record<PhotoContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionFor(contentType: PhotoContentType): string {
  return EXTENSIONS[contentType];
}

export function buildMealPhotoKey(
  patientId: string,
  mealLogId: string,
  contentType: PhotoContentType,
): string {
  return `patients/${patientId}/meal-photos/${mealLogId}-${randomUUID()}.${extensionFor(contentType)}`;
}

export function keyBelongsToPatient(key: string, patientId: string): boolean {
  return key.startsWith(`patients/${patientId}/`);
}
```

- [ ] **Step 5: Rodar e ver passar** → `npx vitest run src/server/storage/r2-keys.test.ts` → 4 passed.

- [ ] **Step 6: Criar `src/server/storage/r2.ts`** (wrapper fino — sem testes; toda lógica está em r2-keys)

```ts
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const globalForR2 = globalThis as unknown as { r2?: S3Client };

function client(): S3Client {
  if (!globalForR2.r2) {
    globalForR2.r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return globalForR2.r2;
}

const bucket = () => process.env.R2_BUCKET_NAME ?? "";

export function createUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 300 }, // 5 min
  );
}

export function createViewUrl(key: string): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: 900, // 15 min
  });
}
```

- [ ] **Step 7: Criar `src/server/services/meal-photos.ts`**

```ts
import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import type { ActionResult, PhotoContentType } from "@/lib/types";
import { buildMealPhotoKey, keyBelongsToPatient } from "@/server/storage/r2-keys";
import { createUploadUrl, createViewUrl } from "@/server/storage/r2";
import { prisma } from "@/server/db";

const MAX_PHOTOS_PER_MEAL = 3;

async function getOwnedTodayLog(mealLogId: string, patientId: string) {
  return prisma.mealLog.findFirst({
    where: {
      id: mealLogId,
      patientId,
      date: utcDateFromDateString(todayInSaoPaulo()),
    },
    include: { _count: { select: { photos: true } } },
  });
}

export async function requestMealPhotoUpload(
  patientId: string,
  mealLogId: string,
  contentType: PhotoContentType,
): Promise<ActionResult<{ key: string; uploadUrl: string }>> {
  const log = await getOwnedTodayLog(mealLogId, patientId);
  if (!log) return { ok: false, error: "Registro não encontrado" }; // 404-style: não vaza existência
  if (log._count.photos >= MAX_PHOTOS_PER_MEAL) {
    return { ok: false, error: `Máximo de ${MAX_PHOTOS_PER_MEAL} fotos por refeição` };
  }
  const key = buildMealPhotoKey(patientId, mealLogId, contentType);
  const uploadUrl = await createUploadUrl(key, contentType);
  return { ok: true, data: { key, uploadUrl } };
}

export async function attachMealPhoto(
  patientId: string,
  mealLogId: string,
  key: string,
): Promise<ActionResult> {
  if (!keyBelongsToPatient(key, patientId)) {
    return { ok: false, error: "Registro não encontrado" };
  }
  const log = await getOwnedTodayLog(mealLogId, patientId);
  if (!log) return { ok: false, error: "Registro não encontrado" };
  if (log._count.photos >= MAX_PHOTOS_PER_MEAL) {
    return { ok: false, error: `Máximo de ${MAX_PHOTOS_PER_MEAL} fotos por refeição` };
  }
  await prisma.mealLogPhoto.create({ data: { mealLogId, r2Key: key } });
  return { ok: true, data: undefined };
}

export async function viewUrlsForKeys(
  patientId: string,
  keys: string[],
): Promise<Record<string, string>> {
  const owned = keys.filter((k) => keyBelongsToPatient(k, patientId));
  const entries = await Promise.all(
    owned.map(async (k) => [k, await createViewUrl(k)] as const),
  );
  return Object.fromEntries(entries);
}
```

- [ ] **Step 8: Criar `src/app/app/photo-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { photoAttachSchema, photoUploadRequestSchema } from "@/lib/validation/meal-log";
import { requirePatient } from "@/server/auth/guards";
import { attachMealPhoto, requestMealPhotoUpload } from "@/server/services/meal-photos";

export async function requestPhotoUploadAction(
  payload: unknown,
): Promise<ActionResult<{ key: string; uploadUrl: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = photoUploadRequestSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  return requestMealPhotoUpload(patient.id, parsed.data.mealLogId, parsed.data.contentType);
}

export async function attachPhotoAction(payload: unknown): Promise<ActionResult> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = photoAttachSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const result = await attachMealPhoto(patient.id, parsed.data.mealLogId, parsed.data.key);
  if (result.ok) revalidatePath("/app");
  return result;
}
```

- [ ] **Step 9: Adicionar placeholders R2 ao `.env.example`**

```
# Cloudflare R2 (fotos do diário) — bucket privado
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="nutrition-media"
```

- [ ] **Step 10: Verificar e commitar**

Run: `npm run test` e `npm run build` → Expected: verdes.

```bash
git add src/server/storage src/server/services/meal-photos.ts src/app/app/photo-actions.ts .env.example package.json package-lock.json
git commit -m "feat: fotos do diario via R2 com URLs pre-assinadas (TDD)"
```

**Critérios de aceite (Codex):** testes passam; upload URL expira em 5 min e view em 15; chave sempre no namespace do paciente; cross-access responde "Registro não encontrado" (nunca 403 revelando existência); máximo 3 fotos por refeição; credenciais R2 nunca chegam ao client.

---

### Task 5: Design system do `/app` + re-skin das telas de auth — [CLAUDE]

**Spec completa:** `docs/design/design-system-prompt.md` (seções 0–9, hard rules, output format). Referência visual: `public/design-preview.html`.

**Files:**
- Modify: `src/app/globals.css` (tokens adicionais do app, se necessários: raios, scrim)
- Create: `src/app/design-system/page.tsx` (+ componentes locais da pasta)
- Modify: `src/app/(auth)/login/page.tsx`, `login-form.tsx`, `change-password/page.tsx`, `change-password-form.tsx` (re-skin: emerald/zinc → tokens da marca, mobile-first, Manrope)

- [ ] **Step 1:** Construir a rota `/design-system` seguindo o prompt: nav fixa com âncoras; seções 0 (shell), 1 (tipografia), 2 (cores/estados — incluindo os semânticos nutricionais e de IA), 3 (navegação), 4 (formulários), 5 (dados nutricionais: linhas de macro, barras, painel de saldo, stat blocks, cards), 6 (componentes), 7 (layout), 8 (motion), 9 (ícones SVG 1.5px). Bloquear em produção: `if (process.env.NODE_ENV === "production") notFound();`.
- [ ] **Step 2:** Re-skin das telas de auth com os tokens (creme, terracota, Manrope nos títulos); manter TODA a lógica (actions, redirects) intacta.
- [ ] **Step 3:** `npm run build` verde; verificação visual em 390 px (login + /design-system).
- [ ] **Step 4:** Commit: `feat: design system do app do paciente e re-skin das telas de auth`

---

### Task 6: Shell do `/app` (bottom nav) + Meu plano — [CLAUDE]

Depende das Tasks 3 e 5.

**Files:**
- Modify: `src/app/app/layout.tsx` (shell mobile-first: sem header pesado; bottom nav fixa)
- Create: `src/app/app/bottom-nav.tsx` (client, ativo por pathname)
- Create: `src/app/app/plan/page.tsx` (Meu plano)

**Especificação:**

- [ ] **Step 1:** Layout: fundo creme, conteúdo `max-w-md mx-auto` com `pb-24` (safe area da nav); bottom nav fixa (blur, borda superior) com 4 destinos: Hoje (`/app`), Diário (`/app/diary`), Meu plano (`/app/plan`), Progresso (desabilitado, título "Fase 5") — ícones SVG inline 1.5px do design system. Manter os redirects de sessão existentes.
- [ ] **Step 2:** Meu plano: metas diárias em stat blocks; cada refeição como card com metas e itens da dieta base (usar `getPatientDay` de hoje para reaproveitar o shape, ignorando os logs). Read-only.
- [ ] **Step 3:** Build verde + verificação visual 390px. Commit: `feat: shell do app do paciente com bottom nav e tela meu plano`

---

### Task 7: Tela Hoje — [CLAUDE]

Depende das Tasks 2, 3, 6. A tela-assinatura do produto (protótipo aprovado como referência).

**Files:**
- Modify: `src/app/app/page.tsx`
- Create: `src/app/app/today-meal-card.tsx` (client: ações rápidas)

**Especificação:**

- [ ] **Step 1:** Server Component: sessão → `getPatientDay(patient.id, todayInSaoPaulo())`. Sem plano ativo: empty state acolhedor ("Seu plano está sendo preparado pela equipe").
- [ ] **Step 2:** Header: saudação por hora do dia ("Bom dia," + nome) + data por extenso (`formatDatePtBr`), eyebrow caps.
- [ ] **Step 3:** Painel de saldo (charcoal, o componente-assinatura): kcal restantes grande em Manrope + "restantes de X" + 3 barras (P/C/G) com caramelo; estados nutricionais: barra >100% muda para o token de estourado.
- [ ] **Step 4:** Lista de refeições: card por slot com nome, meta kcal, status (badge: registrada ✓ com kcal consumidas / pulada / pendente); pendente mostra CTAs rápidos ("Registrar como planejado", link "detalhes" → Task 8); registrada mostra "desfazer" (só hoje). Ações via `today-meal-card.tsx` com `useTransition` + actions da Task 3, `router.refresh()` após sucesso.
- [ ] **Step 5:** Nota do dia: textarea compacta no fim ("Como foi seu dia?") salvando via `saveDiaryNoteAction` (botão salvar com pending).
- [ ] **Step 6:** Verificação manual 390px: registrar plano → saldo recalcula; pular → badge; desfazer → volta a pendente. Build verde. Commit: `feat: tela hoje com saldo do dia e registro rapido`

---

### Task 8: Detalhe da refeição — registro completo (+ fotos 📸 adiadas) — [CLAUDE]

Depende das Tasks 3, 7. O passo de fotos (Step 3, 📸) depende também da Task 4 e é feito só quando o R2 estiver pronto.

**Files:**
- Create: `src/app/app/meals/[slotId]/page.tsx`
- Create: `src/app/app/meals/[slotId]/meal-actions.tsx` (client)
- Create: `src/app/app/meals/[slotId]/photo-uploader.tsx` (client) — 📸 só com a Task 4

**Especificação:**

- [ ] **Step 1:** Server Component (dia = hoje): valida sessão + slot via `getPatientDay` (achar o slot; inexistente → `notFound()`). Layout em camadas do design system: header com voltar, nome da refeição, meta; lista da dieta base (item + detalhe + macros); estado do registro atual.
- [ ] **Step 2:** `meal-actions.tsx`: três caminhos — "Registrar como planejado" (com campo notas opcional), "Registro livre" (form: descrição, kcal, P, C, G, notas — aviso "estimativa sua, marcada como registro livre"), "Pular refeição". Registrado: mostrar resumo + "Desfazer". Tudo com pending/erro visíveis.
- [ ] **Step 3 — 📸 ADIADO (só após a Task 4):** `photo-uploader.tsx` (só quando há registro de hoje): input file (accept dos 3 content-types) → `requestPhotoUploadAction` → `fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })` → `attachPhotoAction` → refresh. Estados: enviando/erro/limite (3). Fotos existentes exibidas via URLs de `viewUrlsForKeys` (server component passa as URLs prontas). **Enquanto o R2 não existe, não crie este componente** — a página funciona sem ele.
- [ ] **Step 4:** Verificação manual: registrar como planejado; registro livre com estimativa; pular; desfazer — tudo sem fotos. (Quando a Task 4 entrar: refazer conferindo upload de foto, URL assinada, limite de 3.) Build verde. Commit: `feat: detalhe da refeicao com registro completo`

---

### Task 9: Diário histórico — [CLAUDE]

Depende das Tasks 3, 8. Miniaturas de fotos (📸) só aparecem depois da Task 4.

**Files:**
- Create: `src/app/app/diary/page.tsx`
- Create: `src/server/services/patient-diary.ts` (query: últimos 14 dias)

**Especificação:**

- [ ] **Step 1:** `patient-diary.ts`: `getPatientDiary(patientId, days = 14)` → lista de dias (desc) com logs (slot name, status, type, consumed, freeDescription, notes, photoKeys) + dayNote + total consumido do dia. (`photoKeys` já vem do schema; renderização das fotos é 📸.)
- [ ] **Step 2:** Página: agrupada por dia (data por extenso; "Hoje"/"Ontem" quando aplicável); cada dia: total kcal + refeições com badges de status e tipo ("registro livre"), notas. **📸 (após Task 4):** miniaturas de fotos via `viewUrlsForKeys`. Dias passados são read-only (sem botões de ação).
- [ ] **Step 3:** Verificação manual + build. Commit: `feat: diario historico do paciente`

---

### Task 10: Verificação final da Fase 3 — [CLAUDE]

- [ ] **Step 1:** `npm run test` e `npm run build` verdes.
- [ ] **Step 2:** Fluxo ponta a ponta no dev server em 390px, logado como paciente de teste:
  1. Hoje: saldo zerado com metas do plano da Fase 2.
  2. Registrar almoço "como planejado" → saldo desconta a dieta base.
  3. Registro livre no jantar → snapshot com números do paciente (marcado como estimativa). *(Foto: só após a Task 4.)*
  4. Pular lanche → badge, sem efeito no saldo.
  5. Desfazer o almoço → saldo volta.
  6. Nota do dia salva e reaparece.
  7. Diário mostra o dia com tudo; `/design-system` renderiza; login re-estilizado.
  8. Admin (`/admin`) intocado e funcionando.
- [ ] **Step 3:** Atualizar `PRD.md` (checkboxes Fase 3) e `AGENTS.md` (plano da fase mais recente).
- [ ] **Step 4:** Commit `docs: fase 3 concluida` + `git push`.

---

## Ordem de execução e paralelismo

```
Task 1 (CLAUDE) → Task 2 (CODEX) → Task 3 (CODEX)
Task 5 (CLAUDE) — paralela às Tasks 2–3 (não compartilha arquivos)
Task 6 → 7 → 8 (sem 📸) → 9 (sem 📸) (CLAUDE, após Task 3) → Task 10 fecha a fase SEM fotos
─── quando o R2 estiver pronto ───
Task 4 (CODEX) → trechos 📸 das Tasks 8 e 9 (CLAUDE) → reverificar
```

## Definition of Done da Fase 3 (sem fotos)

- [ ] `npm run test` e `npm run build` verdes.
- [ ] Snapshot de refeição nunca muda depois de registrado; edição/desfazer só no dia corrente (SP).
- [ ] Saldo do dia = função pura sobre snapshots; barras refletem estourado.
- [ ] Registro livre visivelmente marcado como estimativa do paciente.
- [ ] `/app` inteiro na identidade da marca (nada de emerald); `/design-system` disponível em dev e bloqueada em produção.
- [ ] Paciente não acessa nada de outro paciente; admin continua intocado.

## Definition of Done das fotos (add-on, quando o R2 estiver pronto)

- [ ] Task 4 + trechos 📸 das Tasks 8–9 executados.
- [ ] Fotos: bucket privado, URLs assinadas curtas, namespace por paciente, cross-access não vaza existência, máx. 3 por refeição, credenciais nunca no client.
