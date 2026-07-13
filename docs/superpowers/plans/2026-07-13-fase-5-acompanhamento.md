# Fase 5 (Acompanhamento e Gestão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o MVP: avaliações físicas (equipe completa; paciente registra peso), materiais de apoio (links), linha do tempo de evolução, tela Progresso do paciente com gráfico de peso e aderência, abas reais no perfil do paciente no admin (Avaliações, Diário, Materiais, Evolução) e dashboard analítico na visão geral do admin.

**Architecture:** Leituras agregadas em serviços de query (`patient-progress.ts`, `admin-dashboard.ts`) com cálculos determinísticos testáveis (`computeAdherence` puro). Gráficos **sem biblioteca**: linha de peso em SVG próprio (componente `WeightChart`) e barras de aderência em CSS — dados agregados no banco, nunca em memória sobre listas inteiras. Peso do paciente: 1 registro por dia (upsert do `Assessment` `source: PATIENT` do dia).

**Tech Stack:** Next.js 16, Prisma 7, Zod v4, Vitest, Tailwind v4 (tokens da marca), SVG hand-rolled.

**Executores:** `[CLAUDE]` = frontend/contratos. `[CODEX]` = backend (tarefas autocontidas; TDD sem pular passos).

**Decisões de escopo desta fase (não reabrir durante execução):**
- **Sem R2 (decisão do usuário, 13/07/2026):** materiais só do tipo `LINK`; fotos de progresso NÃO entram; junto com as fotos do diário (Fase 3) e uploads de PDF/imagem, formam **um único add-on R2 futuro** (pré-requisitos e Task 4 da Fase 3 continuam valendo como referência).
- **Aderência = engajamento de registro:** % de refeições com QUALQUER registro (concluída ou pulada) sobre as esperadas (slots do plano ativo × dias da janela). Janelas: 7 e 30 dias. Aproximação assumida: usa o plano ativo atual (histórico de plano não é versionado).
- **Peso do paciente:** 1 por dia-calendário SP (upsert); equipe registra avaliações completas em qualquer data e pode excluir (correção de erro). Avaliações da equipe não são editáveis no MVP — excluir e recriar.
- **Alerta de abandono:** paciente ativo sem NENHUM `MealLog` há 3+ dias.
- **Materiais:** globais (todos os pacientes) ou atribuídos a pacientes específicos; excluíveis pela equipe.
- **Evolução de peso agregada da carteira (RF-122):** simplificada no MVP — a evolução individual vive na aba Evolução de cada paciente; a visão agregada da carteira vai para o backlog junto com o gráfico de correlação métrica × resultado (mesma família de análise).

---

### Task 1: Contratos da Fase 5 — [CLAUDE]

**Files:**
- Create: `src/lib/validation/assessment.ts`
- Create: `src/lib/validation/material.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Adicionar ao final de `src/lib/types.ts`**

```ts
export type AdherenceStats = {
  windowDays: number;
  expected: number; // slots do plano × dias
  logged: number; // refeições com qualquer registro
  pct: number; // 0..100, arredondado
};

export type WeightPoint = {
  date: string; // YYYY-MM-DD
  weightKg: number;
  source: "TEAM" | "PATIENT";
};

export type TimelineEntry = {
  date: string; // YYYY-MM-DD
  kind: "TEAM_ASSESSMENT" | "PATIENT_WEIGHT";
  weightKg: number | null;
  summary: string; // ex: "Avaliação completa · 72,4 kg · 23% GC" | "Peso registrado"
};
```

- [ ] **Step 2: Criar `src/lib/validation/assessment.ts`**

```ts
import { z } from "zod";
import { dateStringSchema } from "./meal-log";

const measure = z.coerce.number().positive().max(500).nullable();

export const teamAssessmentSchema = z
  .object({
    date: dateStringSchema,
    weightKg: z.coerce.number().positive().max(400).nullable(),
    heightCm: measure,
    waistCm: measure,
    hipCm: measure,
    chestCm: measure,
    armCm: measure,
    thighCm: measure,
    bodyFatPct: z.coerce.number().min(1).max(70).nullable(),
    muscleMassKg: z.coerce.number().positive().max(150).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .refine(
    (a) =>
      [a.weightKg, a.heightCm, a.waistCm, a.hipCm, a.chestCm, a.armCm, a.thighCm, a.bodyFatPct, a.muscleMassKg].some(
        (v) => v != null,
      ) || (a.notes != null && a.notes.length > 0),
    { message: "Preencha ao menos uma medida ou observação" },
  );

export const patientWeightSchema = z.object({
  weightKg: z.coerce.number().positive("Informe o peso").max(400),
});

export type TeamAssessmentData = z.infer<typeof teamAssessmentSchema>;
export type PatientWeightData = z.infer<typeof patientWeightSchema>;
```

- [ ] **Step 3: Criar `src/lib/validation/material.ts`**

```ts
import { z } from "zod";

export const materialLinkSchema = z.object({
  title: z.string().trim().min(2, "Dê um título ao material").max(160),
  url: z.url("Link inválido"),
  patientId: z.string().min(1).nullable(), // null = material global (todos os pacientes)
});

export type MaterialLinkData = z.infer<typeof materialLinkSchema>;
```

- [ ] **Step 4: Verificar e commitar**

Run: `npm run build` → verde.

```bash
git add src/lib/types.ts src/lib/validation/assessment.ts src/lib/validation/material.ts
git commit -m "feat: contratos da fase 5 (avaliacoes, peso, materiais, aderencia)"
```

---

### Task 2: Avaliações físicas — serviço (TDD) + actions — [CODEX]

**Files:**
- Create: `src/server/services/assessments.ts` + Test: `src/server/services/assessments.test.ts`
- Create: `src/app/admin/patients/[id]/assessments/actions.ts`
- Modify: `src/app/app/actions.ts` (action de peso do paciente, ao final)

- [ ] **Step 1: Testes (falhando)**

`src/server/services/assessments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { upsertPatientWeightWith, type PatientWeightDeps } from "./assessments";

const TODAY = "2026-07-13";

function makeDeps(existingId: string | null) {
  const calls: Record<string, unknown>[] = [];
  const deps: PatientWeightDeps = {
    findTodayPatientAssessment: async () => (existingId ? { id: existingId } : null),
    createWeight: async (data) => {
      calls.push({ op: "create", ...data });
    },
    updateWeight: async (id, weightKg) => {
      calls.push({ op: "update", id, weightKg });
    },
    today: () => TODAY,
  };
  return { deps, calls };
}

describe("upsertPatientWeightWith", () => {
  it("cria o registro do dia quando não existe", async () => {
    const { deps, calls } = makeDeps(null);
    const result = await upsertPatientWeightWith(deps, "p1", 72.4);
    expect(result.ok).toBe(true);
    expect(calls[0]).toMatchObject({ op: "create", patientId: "p1", weightKg: 72.4, date: TODAY });
  });

  it("atualiza quando já registrou hoje (1 por dia)", async () => {
    const { deps, calls } = makeDeps("a1");
    const result = await upsertPatientWeightWith(deps, "p1", 72.1);
    expect(result.ok).toBe(true);
    expect(calls[0]).toMatchObject({ op: "update", id: "a1", weightKg: 72.1 });
  });

  it("recusa peso não positivo", async () => {
    const { deps, calls } = makeDeps(null);
    const result = await upsertPatientWeightWith(deps, "p1", 0);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `src/server/services/assessments.ts`**

```ts
import { todayInSaoPaulo, utcDateFromDateString } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";
import type { TeamAssessmentData } from "@/lib/validation/assessment";
import { prisma } from "@/server/db";

export type PatientWeightDeps = {
  findTodayPatientAssessment: (patientId: string, dateStr: string) => Promise<{ id: string } | null>;
  createWeight: (data: { patientId: string; date: string; weightKg: number }) => Promise<void>;
  updateWeight: (id: string, weightKg: number) => Promise<void>;
  today: () => string;
};

export async function upsertPatientWeightWith(
  deps: PatientWeightDeps,
  patientId: string,
  weightKg: number,
): Promise<ActionResult> {
  if (!(weightKg > 0)) return { ok: false, error: "Informe um peso válido" };
  const date = deps.today();
  const existing = await deps.findTodayPatientAssessment(patientId, date);
  if (existing) {
    await deps.updateWeight(existing.id, weightKg);
  } else {
    await deps.createWeight({ patientId, date, weightKg });
  }
  return { ok: true, data: undefined };
}

export function upsertPatientWeight(patientId: string, weightKg: number): Promise<ActionResult> {
  return upsertPatientWeightWith(
    {
      findTodayPatientAssessment: (pid, dateStr) =>
        prisma.assessment.findFirst({
          where: { patientId: pid, source: "PATIENT", date: utcDateFromDateString(dateStr) },
          select: { id: true },
        }),
      createWeight: async (data) => {
        await prisma.assessment.create({
          data: {
            patientId: data.patientId,
            source: "PATIENT",
            date: utcDateFromDateString(data.date),
            weightKg: data.weightKg,
          },
        });
      },
      updateWeight: async (id, weightKg) => {
        await prisma.assessment.update({ where: { id }, data: { weightKg } });
      },
      today: () => todayInSaoPaulo(),
    },
    patientId,
    weightKg,
  );
}

export async function createTeamAssessment(
  patientId: string,
  recordedById: string,
  input: TeamAssessmentData,
): Promise<ActionResult<{ id: string }>> {
  const created = await prisma.assessment.create({
    data: {
      patientId,
      source: "TEAM",
      recordedById,
      date: utcDateFromDateString(input.date),
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      chestCm: input.chestCm,
      armCm: input.armCm,
      thighCm: input.thighCm,
      bodyFatPct: input.bodyFatPct,
      muscleMassKg: input.muscleMassKg,
      notes: input.notes,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: created.id } };
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  await prisma.assessment.delete({ where: { id } });
  return { ok: true, data: undefined };
}
```

- [ ] **Step 4: Rodar e ver passar (3 novos; antigos intactos).**

- [ ] **Step 5: Actions.** `src/app/admin/patients/[id]/assessments/actions.ts`: `createAssessmentAction(patientId, formData)` (requireAdmin; validar paciente `role: PATIENT` existe; `teamAssessmentSchema.safeParse` de todos os campos com `formData.get(...) || null`; `createTeamAssessment(patientId, admin.id, data)`; revalidate `/admin/patients/${patientId}/assessments`) e `deleteAssessmentAction(id, patientId)` (requireAdmin; delete; revalidate). No `src/app/app/actions.ts`, ao final: `registerWeightAction(payload)` — `requirePatient`, `patientWeightSchema`, `upsertPatientWeight`, `revalidatePath("/app/progress")`.

- [ ] **Step 6: Verificar e commitar**

```bash
git add src/server/services/assessments.ts src/server/services/assessments.test.ts "src/app/admin/patients/[id]/assessments" src/app/app/actions.ts
git commit -m "feat: avaliacoes fisicas e peso do paciente (TDD)"
```

**Critérios de aceite (Codex):** testes passam; peso do paciente é 1/dia (upsert); datas via helpers de `src/lib/dates.ts`; paciente NUNCA cria avaliação TEAM; actions revalidam as rotas certas.

---

### Task 3: Materiais (links) — serviço + actions — [CODEX]

**Files:**
- Create: `src/server/services/materials.ts` + Test: `src/server/services/materials.test.ts`
- Create: `src/app/admin/materials/actions.ts`

- [ ] **Step 1: Teste da regra de visibilidade (falhando)** — a única lógica com risco:

```ts
import { describe, expect, it } from "vitest";
import { visibleToPatient } from "./materials";

const materials = [
  { id: "g1", isGlobal: true, assignedPatientIds: [] },
  { id: "m1", isGlobal: false, assignedPatientIds: ["p1"] },
  { id: "m2", isGlobal: false, assignedPatientIds: ["p2"] },
];

describe("visibleToPatient", () => {
  it("paciente vê globais + atribuídos a ele, nunca de outros", () => {
    expect(materials.filter((m) => visibleToPatient(m, "p1")).map((m) => m.id)).toEqual(["g1", "m1"]);
    expect(materials.filter((m) => visibleToPatient(m, "p3")).map((m) => m.id)).toEqual(["g1"]);
  });
});
```

- [ ] **Step 2: Ver falhar; implementar `src/server/services/materials.ts`**

```ts
import type { ActionResult } from "@/lib/types";
import type { MaterialLinkData } from "@/lib/validation/material";
import { prisma } from "@/server/db";

export function visibleToPatient(
  material: { isGlobal: boolean; assignedPatientIds: string[] },
  patientId: string,
): boolean {
  return material.isGlobal || material.assignedPatientIds.includes(patientId);
}

export async function createLinkMaterial(
  uploadedById: string,
  input: MaterialLinkData,
): Promise<ActionResult<{ id: string }>> {
  const created = await prisma.material.create({
    data: {
      title: input.title,
      type: "LINK",
      url: input.url,
      isGlobal: input.patientId == null,
      uploadedById,
      ...(input.patientId
        ? { assignments: { create: { patientId: input.patientId } } }
        : {}),
    },
    select: { id: true },
  });
  return { ok: true, data: { id: created.id } };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  await prisma.material.delete({ where: { id } });
  return { ok: true, data: undefined };
}

/** Materiais que o paciente pode ver: globais + atribuídos a ele. */
export function getPatientMaterials(patientId: string) {
  return prisma.material.findMany({
    where: { OR: [{ isGlobal: true }, { assignments: { some: { patientId } } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, type: true, url: true, createdAt: true },
  });
}
```

- [ ] **Step 3: Ver passar; criar `src/app/admin/materials/actions.ts`**: `createMaterialAction(formData)` (requireAdmin; `materialLinkSchema` com `patientId: formData.get("patientId") || null`; se `patientId` informado, validar que é um User `role: PATIENT`; `createLinkMaterial(admin.id, data)`; revalidate `/admin/materials`) e `deleteMaterialAction(id)` (requireAdmin; delete; revalidate).

- [ ] **Step 4: Verificar e commitar**

```bash
git add src/server/services/materials.ts src/server/services/materials.test.ts src/app/admin/materials
git commit -m "feat: materiais de apoio por link (TDD)"
```

**Critérios de aceite (Codex):** teste passa; `getPatientMaterials` NUNCA devolve material atribuído a outro paciente; delete em cascata remove assignments (FK do schema).

---

### Task 4: Aderência (TDD) + queries de progresso e dashboard — [CODEX]

**Files:**
- Modify: `src/lib/nutrition.ts` + `src/lib/nutrition.test.ts` (adicionar `computeAdherence` ao FINAL)
- Create: `src/server/services/patient-progress.ts`
- Create: `src/server/services/admin-dashboard.ts`

- [ ] **Step 1: Testes de `computeAdherence` ao final de `nutrition.test.ts` (falhando)**

```ts
import { computeAdherence } from "./nutrition";

describe("computeAdherence", () => {
  it("calcula % de registros sobre o esperado", () => {
    expect(computeAdherence(4, 7, 21)).toEqual({ windowDays: 7, expected: 28, logged: 21, pct: 75 });
  });
  it("clampa em 100 e trata esperado 0", () => {
    expect(computeAdherence(4, 7, 40).pct).toBe(100);
    expect(computeAdherence(0, 7, 0).pct).toBe(0);
  });
});
```

- [ ] **Step 2: Ver falhar; implementar ao final de `src/lib/nutrition.ts`**

```ts
import type { AdherenceStats } from "./types";

export function computeAdherence(
  slotsPerDay: number,
  windowDays: number,
  loggedCount: number,
): AdherenceStats {
  const expected = slotsPerDay * windowDays;
  const pct = expected <= 0 ? 0 : Math.min(100, Math.round((loggedCount / expected) * 100));
  return { windowDays, expected, logged: Math.min(loggedCount, expected), pct };
}
```

- [ ] **Step 3: Ver passar; criar `src/server/services/patient-progress.ts`** (query, sem TDD — código completo)

```ts
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

  const [adherence7, adherence30] = await Promise.all([
    adherenceFor(patientId, 7),
    adherenceFor(patientId, 30),
  ]);

  return { weights, currentWeightKg, delta30dKg, adherence7, adherence30, timeline };
}
```

- [ ] **Step 4: Criar `src/server/services/admin-dashboard.ts`**

```ts
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
```

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test` e `npm run build` → verdes.

```bash
git add src/lib/nutrition.ts src/lib/nutrition.test.ts src/server/services/patient-progress.ts src/server/services/admin-dashboard.ts
git commit -m "feat: aderencia, progresso do paciente e dashboard do admin (TDD)"
```

**Critérios de aceite (Codex):** testes passam; nada existente em `nutrition.ts` mudou (continua puro); agregações no banco (counts/aggregate), nunca varrendo logs em memória; alertas só de pacientes ativos.

---

### Task 5: UI — Tela Progresso do paciente — [CLAUDE]

Depende das Tasks 2 e 4.

**Files:**
- Create: `src/app/app/progress/page.tsx`
- Create: `src/app/app/progress/weight-chart.tsx` (SVG próprio)
- Create: `src/app/app/progress/weight-form.tsx` (client)
- Modify: `src/app/app/bottom-nav.tsx` (habilitar Progresso → `/app/progress`)

**Especificação:**

- [ ] **Step 1:** `WeightChart` (server component, SVG puro): props `points: WeightPoint[]`; viewBox `0 0 320 140`; normaliza datas→x e pesos→y com margem; `<polyline>` caramelo (`stroke-caramel-500`, width 2) + círculos (r 3, terracota para TEAM, caramelo para PATIENT) + labels min/max discretos (`text-[9px]` ink-300). Menos de 2 pontos → mensagem "Registre seu peso para acompanhar a evolução".
- [ ] **Step 2:** `weight-form.tsx`: input numérico (step 0.1) + botão "Registrar peso de hoje" → `registerWeightAction`; pending/erro; nota "1 registro por dia — registrar de novo substitui o de hoje".
- [ ] **Step 3:** `page.tsx`: `requirePatient` → `getPatientProgress`; stat blocks no painel charcoal (peso atual, Δ 30 dias com sinal, aderência 7d %); gráfico; form; timeline (lista desc: data por extenso curta, ícone por tipo, summary; TEAM com badge "equipe").
- [ ] **Step 4:** `bottom-nav.tsx`: item Progresso deixa de ser disabled → `{ href: "/app/progress", label: "Progresso", icon: "chart", exact: false }`.
- [ ] **Step 5:** Verificação manual 390 px (registrar peso → gráfico e stats atualizam; registrar de novo substitui). Build verde. Commit: `feat: tela progresso do paciente com grafico de peso e aderencia`

---

### Task 6: UI — Abas reais no perfil do paciente (admin) — [CLAUDE]

Depende das Tasks 2, 3, 4. Transforma as 4 abas desabilitadas em rotas reais.

**Files:**
- Create: `src/app/admin/patients/[id]/patient-tabs.tsx` (nav compartilhada das abas)
- Create: `src/app/admin/patients/[id]/assessments/page.tsx` + `assessment-form.tsx` (client)
- Create: `src/app/admin/patients/[id]/diary/page.tsx`
- Create: `src/app/admin/patients/[id]/materials/page.tsx`
- Create: `src/app/admin/patients/[id]/evolution/page.tsx`
- Modify: `src/app/admin/patients/[id]/page.tsx` (usar `PatientTabs`)

**Especificação:**

- [ ] **Step 1:** `PatientTabs({ patientId, active })`: Dados (`/admin/patients/[id]`), Plano alimentar (`…/plan`), Avaliações (`…/assessments`), Diário (`…/diary`), Materiais (`…/materials`), Evolução (`…/evolution`) — mesmo estilo de underline atual. Substituir a nav do detalhe.
- [ ] **Step 2:** **Avaliações**: tabela desc (data, peso, % GC, cintura, notas truncadas, quem registrou, botão excluir com confirm) + `assessment-form.tsx` colapsável "Nova avaliação" (grid de campos numéricos do `teamAssessmentSchema`, data default hoje) → `createAssessmentAction`.
- [ ] **Step 3:** **Diário**: reutilizar `getPatientDiary(patientId)` (Fase 3) — mesma renderização agrupada por dia, read-only, com nota "visão do diário do paciente".
- [ ] **Step 4:** **Materiais**: lista dos materiais visíveis ao paciente (`getPatientMaterials`) com badge global/específico + form inline "Atribuir material por link" (título + URL) → `createMaterialAction` com `patientId` fixo.
- [ ] **Step 5:** **Evolução**: reutilizar `WeightChart` + stats de `getPatientProgress` (mesma visão do paciente, versão desktop) + timeline.
- [ ] **Step 6:** Verificação manual: criar avaliação completa → aparece na Evolução e no Progresso do paciente; excluir funciona. Build verde. Commit: `feat: abas de acompanhamento no perfil do paciente (admin)`

---

### Task 7: UI — Materiais globais + Materiais no app do paciente — [CLAUDE]

Depende da Task 3.

**Files:**
- Create: `src/app/admin/materials/page.tsx`
- Modify: `src/app/admin/nav-links.tsx` (+ "Materiais")
- Create: `src/app/app/materials/page.tsx`
- Modify: `src/app/app/plan/page.tsx` (card "Materiais da sua nutri" quando houver materiais — a bottom nav não muda)

**Especificação:**

- [ ] **Step 1:** Admin `/admin/materials`: tabela (título, alvo global/paciente, data, excluir) + form "Novo material por link" (título, URL, select de paciente com opção "Todos os pacientes"). Aviso discreto: "Upload de PDF/imagem chega com o armazenamento de arquivos (R2)".
- [ ] **Step 2:** Paciente `/app/materials`: lista de cards (ícone link, título, domínio do link) abrindo em nova aba (`rel="noopener noreferrer"`); empty state acolhedor. Acesso: card no fim de "Meu plano" (visível só se houver materiais) — a bottom nav não muda.
- [ ] **Step 3:** Verificação manual: material global aparece para o paciente; material de outro paciente NÃO aparece. Build verde. Commit: `feat: materiais de apoio no admin e no app do paciente`

---

### Task 8: UI — Dashboard analítico na visão geral do admin — [CLAUDE]

Depende da Task 4.

**Files:**
- Modify: `src/app/admin/page.tsx` (substituir o placeholder)

**Especificação:**

- [ ] **Step 1:** Server component com `getAdminDashboard()`: linha de 4 cards (pacientes ativos, registros hoje, fila de curadoria — link para `?status=PENDING_REVIEW` —, custo de IA no mês); seção "⚠️ Sem registro há 3+ dias" (lista com nome → link pro perfil, "há N dias" ou "nunca registrou"; vazia → "Todos os pacientes ativos registraram recentemente ✓"); seção "Aderência (7 dias)": lista de pacientes com barra CSS (width = pct%, caramelo; <50% terracota) + % + link.
- [ ] **Step 2:** Verificação manual + build. Commit: `feat: dashboard analitico na visao geral do admin`

---

### Task 9: Verificação final da Fase 5 + fechamento do MVP — [CLAUDE]

- [ ] **Step 1:** `npm run test` e `npm run build` verdes.
- [ ] **Step 2:** Ponta a ponta:
  1. Paciente: registra peso → Progresso mostra gráfico/stats; registra de novo → substitui.
  2. Admin: avaliação completa → Evolução (admin) e Progresso (paciente) atualizam; excluir funciona.
  3. Materiais: global visível ao paciente; específico só ao alvo; excluir some.
  4. Dashboard: números batem (conferir curadoria e custo contra `/admin/ai-usage`); alerta aparece para paciente parado.
  5. Diário do paciente legível no admin.
- [ ] **Step 3:** Atualizar `PRD.md`: checkboxes da Fase 5 + seção de status geral do MVP (o que está 100%, o que segue adiado: add-on R2 e backlog pós-MVP).
- [ ] **Step 4:** Atualizar `AGENTS.md` (fase mais recente) e commit `docs: fase 5 concluida - mvp completo` + `git push`.

---

## Ordem de execução e paralelismo

```
Task 1 (CLAUDE) → Tasks 2, 3, 4 (CODEX, em sequência)
Tasks 5–8 (CLAUDE, após os respectivos backends; 5 e 6 podem intercalar) → Task 9 fecha o MVP
```

## Definition of Done da Fase 5 (e do MVP)

- [ ] `npm run test` e `npm run build` verdes.
- [ ] Peso do paciente 1/dia; avaliações da equipe com todas as medidas; exclusão funciona.
- [ ] Aderência calculada por `computeAdherence` (puro, testado); agregações no banco.
- [ ] Materiais: visibilidade correta (global + atribuído), nunca vazando entre pacientes.
- [ ] Gráficos sem dependência nova (SVG/CSS próprios).
- [ ] Dashboard: cards, alertas de abandono e aderência por paciente.
- [ ] PRD atualizado com o status final do MVP; pendências explícitas (add-on R2, backlog pós-MVP).
