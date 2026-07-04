# Fase 2 (Admin core) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel admin funcional: banco de ingredientes com busca e cadastro, banco de receitas com recálculo automático de macros (soma de ingredientes — nunca LLM), gestão de pacientes (cadastro com senha provisória, perfil, reset de senha, limite de IA) e editor de plano alimentar (metas diárias, refeições configuráveis, dieta base).

**Architecture:** Lógica de negócio em `src/server/services/` (funções `*With(deps, ...)` testáveis com dependências injetadas + wrapper de produção com Prisma). Matemática nutricional pura e isomórfica em `src/lib/nutrition.ts` (o mesmo código roda no composer client-side para totais ao vivo e no servidor como autoridade). Server actions finas colocadas nas rotas (`src/app/admin/**/actions.ts`) chamam os serviços e revalidam. Páginas admin são Server Components; interatividade real (composer de receita, editor de plano) em Client Components.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (client só via `src/server/db.ts`), Zod v4, Vitest, Tailwind v4 (`@theme` com tokens da marca), Auth.js v5.

**Executores:** `[CLAUDE]` = frontend/contratos (executor tem o contexto do projeto; tarefas trazem especificação precisa + código dos trechos críticos). `[CODEX]` = backend (tarefas autocontidas com código completo, comandos e critérios de aceite — seguir passos na ordem, sem pular testes).

**Decisões de escopo desta fase (não reabrir durante execução):**
- Receita criada pela equipe nasce `status: APPROVED`, `origin: TEAM` (curadoria é só para receitas de IA — Fase 4).
- Sem exclusão de ingredientes/receitas no MVP (FKs de histórico); paciente é **desativado**, nunca excluído.
- Divergência entre metas diárias e soma das metas das refeições **não bloqueia** salvar — a UI mostra o delta como aviso.
- Fotos de receita ficam para a fase do design system do paciente (R2 entra na Fase 3/5); o schema não muda nesta fase.
- Medidas caseiras de ingrediente (RF-24, campo `householdMeasures` já no schema) ficam para quando o app do paciente precisar delas (Fase 3+) — sem UI de edição nesta fase.

---

### Task 1: Contratos compartilhados da Fase 2 — [CLAUDE]

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/validation/ingredient.ts`
- Create: `src/lib/validation/recipe.ts`
- Create: `src/lib/validation/patient.ts`
- Create: `src/lib/validation/meal-plan.ts`

- [ ] **Step 1: Ampliar `src/lib/types.ts`** (adicionar ao final; nada existente muda)

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Espelha o enum MealType do Prisma (não importar @prisma/client aqui)
export const MEAL_TYPES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SUPPER",
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "Café da manhã",
  MORNING_SNACK: "Lanche da manhã",
  LUNCH: "Almoço",
  AFTERNOON_SNACK: "Lanche da tarde",
  DINNER: "Jantar",
  SUPPER: "Ceia",
};

export type Sex = "MALE" | "FEMALE";

// Macros de um ingrediente por 100 g
export type IngredientMacros = {
  kcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
};
```

- [ ] **Step 2: Criar `src/lib/validation/ingredient.ts`**

```ts
import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  kcalPer100g: z.coerce.number().min(0).max(900),
  proteinGPer100g: z.coerce.number().min(0).max(100),
  carbsGPer100g: z.coerce.number().min(0).max(100),
  fatGPer100g: z.coerce.number().min(0).max(100),
  fiberGPer100g: z.coerce.number().min(0).max(100).nullable(),
});

export type IngredientInputData = z.infer<typeof ingredientSchema>;
```

- [ ] **Step 3: Criar `src/lib/validation/recipe.ts`**

```ts
import { z } from "zod";
import { MEAL_TYPES } from "@/lib/types";

export const recipeIngredientInputSchema = z.object({
  ingredientId: z.string().min(1),
  quantityG: z.coerce.number().positive("Quantidade deve ser positiva").max(5000),
});

export const recipeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  instructions: z.string().trim().min(1, "Descreva o modo de preparo"),
  servings: z.coerce.number().positive().max(50),
  suitableMealTypes: z.array(z.enum(MEAL_TYPES)).min(1, "Escolha ao menos um tipo de refeição"),
  ingredients: z.array(recipeIngredientInputSchema).min(1, "Adicione ao menos um ingrediente"),
});

export type RecipeInputData = z.infer<typeof recipeSchema>;
```

- [ ] **Step 4: Criar `src/lib/validation/patient.ts`**

```ts
import { z } from "zod";

export const patientCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Email inválido"),
  birthDate: z.coerce.date().nullable(),
  sex: z.enum(["MALE", "FEMALE"]).nullable(),
  teamNotes: z.string().trim().max(2000).nullable(),
});

export const patientUpdateSchema = patientCreateSchema.omit({ email: true }).extend({
  dailyAiLimit: z.coerce.number().int().min(0).max(100),
  active: z.coerce.boolean(),
});

export type PatientCreateData = z.infer<typeof patientCreateSchema>;
export type PatientUpdateData = z.infer<typeof patientUpdateSchema>;
```

- [ ] **Step 5: Criar `src/lib/validation/meal-plan.ts`**

```ts
import { z } from "zod";
import { MEAL_TYPES } from "@/lib/types";

// Item da dieta base: exatamente UM de (ingrediente+gramas) OU (receita+porções)
export const mealSlotItemSchema = z
  .object({
    ingredientId: z.string().nullable(),
    quantityG: z.coerce.number().positive().max(5000).nullable(),
    recipeId: z.string().nullable(),
    servings: z.coerce.number().positive().max(50).nullable(),
  })
  .refine(
    (i) =>
      (i.ingredientId != null && i.quantityG != null && i.recipeId == null && i.servings == null) ||
      (i.recipeId != null && i.servings != null && i.ingredientId == null && i.quantityG == null),
    { message: "Item deve ser ingrediente+gramas OU receita+porções" },
  );

export const mealSlotSchema = z.object({
  id: z.string().nullable(), // null = slot novo
  name: z.string().trim().min(1).max(60),
  order: z.coerce.number().int().min(0),
  mealType: z.enum(MEAL_TYPES),
  timeHint: z.string().trim().max(20).nullable(),
  kcal: z.coerce.number().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500),
  carbsG: z.coerce.number().min(0).max(800),
  fatG: z.coerce.number().min(0).max(300),
  items: z.array(mealSlotItemSchema),
});

export const mealPlanSchema = z.object({
  dailyKcal: z.coerce.number().positive().max(8000),
  dailyProteinG: z.coerce.number().min(0).max(500),
  dailyCarbsG: z.coerce.number().min(0).max(800),
  dailyFatG: z.coerce.number().min(0).max(300),
  slots: z.array(mealSlotSchema).min(1, "O plano precisa de ao menos uma refeição"),
});

export type MealSlotItemData = z.infer<typeof mealSlotItemSchema>;
export type MealSlotData = z.infer<typeof mealSlotSchema>;
export type MealPlanData = z.infer<typeof mealPlanSchema>;
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm run build` → Expected: sem erros de tipo.

```bash
git add src/lib
git commit -m "feat: contratos da fase 2 (tipos, schemas de ingrediente, receita, paciente e plano)"
```

---

### Task 2: Matemática nutricional pura (TDD) — [CODEX]

A fundação de TODO cálculo do produto. **Princípio inegociável:** valores nutricionais são sempre derivados de ingredientes verificados por aritmética — nenhum outro código pode "inventar" macros.

**Files:**
- Create: `src/lib/nutrition.ts` (puro, isomórfico — SEM imports de Prisma/server)
- Test: `src/lib/nutrition.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/nutrition.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeRecipeTotals, scalePer100, scaleServing, sumMacros, round1 } from "./nutrition";
import type { MacroTotals } from "./types";

const arroz = { kcalPer100g: 124, proteinGPer100g: 2.6, carbsGPer100g: 25.8, fatGPer100g: 1 };
const frango = { kcalPer100g: 159, proteinGPer100g: 32, carbsGPer100g: 0, fatGPer100g: 2.5 };

describe("round1", () => {
  it("arredonda para 1 casa decimal", () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(1.24)).toBe(1.2);
  });
});

describe("scalePer100", () => {
  it("100 g devolve os macros de tabela", () => {
    expect(scalePer100(arroz, 100)).toEqual({ kcal: 124, proteinG: 2.6, carbsG: 25.8, fatG: 1 });
  });
  it("escala linearmente por gramas", () => {
    expect(scalePer100(arroz, 50)).toEqual({ kcal: 62, proteinG: 1.3, carbsG: 12.9, fatG: 0.5 });
  });
});

describe("scaleServing", () => {
  it("multiplica macros por porções", () => {
    const perServing: MacroTotals = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 };
    expect(scaleServing(perServing, 1.5)).toEqual({ kcal: 300, proteinG: 15, carbsG: 30, fatG: 7.5 });
  });
});

describe("sumMacros", () => {
  it("soma uma lista de macros", () => {
    const a: MacroTotals = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 };
    const b: MacroTotals = { kcal: 50, proteinG: 2.5, carbsG: 5, fatG: 1 };
    expect(sumMacros([a, b])).toEqual({ kcal: 150, proteinG: 7.5, carbsG: 15, fatG: 3 });
  });
  it("lista vazia devolve zeros", () => {
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("computeRecipeTotals", () => {
  it("soma ingredientes e divide pelo rendimento (por porção)", () => {
    const totals = computeRecipeTotals(
      [
        { quantityG: 200, ingredient: arroz },
        { quantityG: 150, ingredient: frango },
      ],
      2,
    );
    // 200g arroz = 248 kcal, 5.2 P, 51.6 C, 2 G · 150g frango = 238.5 kcal, 48 P, 0 C, 3.75 G
    // total 486.5 / 2 porções = 243.3 (round1)
    expect(totals).toEqual({ kcal: 243.3, proteinG: 26.6, carbsG: 25.8, fatG: 2.9 });
  });
  it("rendimento <= 0 lança erro", () => {
    expect(() => computeRecipeTotals([{ quantityG: 100, ingredient: arroz }], 0)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/nutrition.test.ts`
Expected: FAIL — módulo `./nutrition` não existe.

- [ ] **Step 3: Implementar `src/lib/nutrition.ts`**

```ts
// Matemática nutricional pura e isomórfica (client + server).
// ÚNICA fonte de cálculo de macros do sistema — nunca duplicar esta aritmética.
import type { IngredientMacros, MacroTotals } from "./types";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scalePer100(macros: IngredientMacros, grams: number): MacroTotals {
  const f = grams / 100;
  return {
    kcal: round1(macros.kcalPer100g * f),
    proteinG: round1(macros.proteinGPer100g * f),
    carbsG: round1(macros.carbsGPer100g * f),
    fatG: round1(macros.fatGPer100g * f),
  };
}

export function scaleServing(perServing: MacroTotals, servings: number): MacroTotals {
  return {
    kcal: round1(perServing.kcal * servings),
    proteinG: round1(perServing.proteinG * servings),
    carbsG: round1(perServing.carbsG * servings),
    fatG: round1(perServing.fatG * servings),
  };
}

export function sumMacros(list: MacroTotals[]): MacroTotals {
  return list.reduce(
    (acc, m) => ({
      kcal: round1(acc.kcal + m.kcal),
      proteinG: round1(acc.proteinG + m.proteinG),
      carbsG: round1(acc.carbsG + m.carbsG),
      fatG: round1(acc.fatG + m.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export type RecipeIngredientAmount = {
  quantityG: number;
  ingredient: IngredientMacros;
};

export function computeRecipeTotals(
  items: RecipeIngredientAmount[],
  servings: number,
): MacroTotals {
  if (servings <= 0) throw new Error("Rendimento deve ser positivo");
  const total = sumMacros(items.map((i) => scalePer100(i.ingredient, i.quantityG)));
  return {
    kcal: round1(total.kcal / servings),
    proteinG: round1(total.proteinG / servings),
    carbsG: round1(total.carbsG / servings),
    fatG: round1(total.fatG / servings),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/nutrition.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition.ts src/lib/nutrition.test.ts
git commit -m "feat: matematica nutricional pura (TDD)"
```

**Critérios de aceite (Codex):** todos os testes passam; arquivo sem nenhum import de servidor/Prisma; toda função devolve valores com `round1`.

---

### Task 3: Guard de admin + serviço e actions de Ingredientes — [CODEX]

**Files:**
- Create: `src/server/auth/guards.ts`
- Create: `src/server/services/ingredients.ts`
- Test: `src/server/services/ingredients.test.ts`
- Create: `src/app/admin/ingredients/actions.ts`
- Create: `src/app/api/admin/ingredients/search/route.ts`

- [ ] **Step 1: Criar `src/server/auth/guards.ts`**

```ts
import { auth } from "@/server/auth";

export async function requireAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return { id: session.user.id };
}
```

- [ ] **Step 2: Escrever testes do serviço (falhando)**

`src/server/services/ingredients.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { saveCustomIngredientWith, type IngredientDeps } from "./ingredients";

function makeDeps() {
  const saved: unknown[] = [];
  const deps: IngredientDeps = {
    findByName: async () => null,
    create: async (data) => {
      saved.push(data);
      return { id: "i1" };
    },
    update: async (id, data) => {
      saved.push({ id, ...data });
    },
  };
  return { deps, saved };
}

describe("saveCustomIngredientWith", () => {
  const input = {
    name: "  Whey da marca X  ",
    kcalPer100g: 400,
    proteinGPer100g: 80,
    carbsGPer100g: 10,
    fatGPer100g: 5,
    fiberGPer100g: null,
  };

  it("cria ingrediente CUSTOM com nome normalizado", async () => {
    const { deps, saved } = makeDeps();
    const result = await saveCustomIngredientWith(deps, input, null);
    expect(result).toEqual({ ok: true, data: { id: "i1" } });
    expect(saved[0]).toMatchObject({ name: "Whey da marca X", source: "CUSTOM" });
  });

  it("recusa nome duplicado ao criar", async () => {
    const { deps } = makeDeps();
    deps.findByName = async () => ({ id: "outro" });
    const result = await saveCustomIngredientWith(deps, input, null);
    expect(result).toEqual({ ok: false, error: "Já existe um ingrediente com esse nome" });
  });

  it("atualiza quando recebe id (e permite o próprio nome)", async () => {
    const { deps, saved } = makeDeps();
    deps.findByName = async () => ({ id: "i1" });
    const result = await saveCustomIngredientWith(deps, input, "i1");
    expect(result.ok).toBe(true);
    expect(saved[0]).toMatchObject({ id: "i1", name: "Whey da marca X" });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/server/services/ingredients.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar `src/server/services/ingredients.ts`**

```ts
import type { ActionResult } from "@/lib/types";
import type { IngredientInputData } from "@/lib/validation/ingredient";
import { prisma } from "@/server/db";

export type IngredientDeps = {
  findByName: (name: string) => Promise<{ id: string } | null>;
  create: (data: IngredientInputData & { source: "CUSTOM" }) => Promise<{ id: string }>;
  update: (id: string, data: IngredientInputData) => Promise<void>;
};

export async function saveCustomIngredientWith(
  deps: IngredientDeps,
  input: IngredientInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  const name = input.name.trim();
  const existing = await deps.findByName(name);
  if (existing && existing.id !== id) {
    return { ok: false, error: "Já existe um ingrediente com esse nome" };
  }
  if (id) {
    await deps.update(id, { ...input, name });
    return { ok: true, data: { id } };
  }
  const created = await deps.create({ ...input, name, source: "CUSTOM" });
  return { ok: true, data: { id: created.id } };
}

export function saveCustomIngredient(
  input: IngredientInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  return saveCustomIngredientWith(
    {
      findByName: (name) =>
        prisma.ingredient.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } }),
      create: (data) => prisma.ingredient.create({ data, select: { id: true } }),
      update: async (ingredientId, data) => {
        await prisma.ingredient.update({ where: { id: ingredientId }, data });
      },
    },
    input,
    id,
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/server/services/ingredients.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Criar `src/app/admin/ingredients/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { ingredientSchema } from "@/lib/validation/ingredient";
import { requireAdmin } from "@/server/auth/guards";
import { saveCustomIngredient } from "@/server/services/ingredients";

export async function saveIngredientAction(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    kcalPer100g: formData.get("kcalPer100g"),
    proteinGPer100g: formData.get("proteinGPer100g"),
    carbsGPer100g: formData.get("carbsGPer100g"),
    fatGPer100g: formData.get("fatGPer100g"),
    fiberGPer100g: formData.get("fiberGPer100g") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await saveCustomIngredient(parsed.data, id);
  if (result.ok) revalidatePath("/admin/ingredients");
  return result;
}
```

- [ ] **Step 7: Criar `src/app/api/admin/ingredients/search/route.ts`** (usado pelo composer de receitas e pelo editor de plano)

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = await prisma.ingredient.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      source: true,
      kcalPer100g: true,
      proteinGPer100g: true,
      carbsGPer100g: true,
      fatGPer100g: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return NextResponse.json({ items });
}
```

- [ ] **Step 8: Verificar e commitar**

Run: `npm run test` → Expected: todos passam.
Run: `npm run build` → Expected: sem erros.

```bash
git add src/server/auth/guards.ts src/server/services/ingredients.ts src/server/services/ingredients.test.ts src/app/admin/ingredients/actions.ts src/app/api/admin/ingredients/search
git commit -m "feat: servico e actions de ingredientes + guard de admin (TDD)"
```

**Critérios de aceite (Codex):** testes passam; toda action/handler valida admin antes de tocar no banco; nome duplicado recusado case-insensitive; busca retorna no máximo 20 itens com macros.

---

### Task 4: Serviço e actions de Receitas (recálculo de macros) — [CODEX]

**Files:**
- Create: `src/server/services/recipes.ts`
- Test: `src/server/services/recipes.test.ts`
- Create: `src/app/admin/recipes/actions.ts`
- Create: `src/app/api/admin/recipes/search/route.ts`

- [ ] **Step 1: Escrever testes (falhando)**

`src/server/services/recipes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { saveTeamRecipeWith, type RecipeDeps, type RecipePersistData } from "./recipes";

const arroz = { id: "ing-arroz", kcalPer100g: 124, proteinGPer100g: 2.6, carbsGPer100g: 25.8, fatGPer100g: 1 };

const input = {
  name: "Arroz solto",
  instructions: "Cozinhe.",
  servings: 2,
  suitableMealTypes: ["LUNCH" as const],
  ingredients: [{ ingredientId: "ing-arroz", quantityG: 200 }],
};

function makeDeps() {
  const persisted: RecipePersistData[] = [];
  const deps: RecipeDeps = {
    findIngredientMacros: async () => [arroz],
    persist: async (data) => {
      persisted.push(data);
      return { id: "r1" };
    },
  };
  return { deps, persisted };
}

describe("saveTeamRecipeWith", () => {
  it("calcula totais por porção pelo sistema e persiste APPROVED/TEAM", async () => {
    const { deps, persisted } = makeDeps();
    const result = await saveTeamRecipeWith(deps, input, null);
    expect(result).toEqual({ ok: true, data: { id: "r1" } });
    expect(persisted[0]).toMatchObject({
      id: null,
      status: "APPROVED",
      origin: "TEAM",
      // 200g arroz = 248 kcal / 2 porções = 124
      kcalPerServing: 124,
      proteinGPerServing: 2.6,
      carbsGPerServing: 25.8,
      fatGPerServing: 1,
    });
  });

  it("recusa ingrediente inexistente no banco", async () => {
    const { deps } = makeDeps();
    deps.findIngredientMacros = async () => [];
    const result = await saveTeamRecipeWith(deps, input, null);
    expect(result).toEqual({ ok: false, error: "Ingrediente não encontrado: ing-arroz" });
  });

  it("recusa ingrediente duplicado na lista", async () => {
    const { deps } = makeDeps();
    const dup = { ...input, ingredients: [...input.ingredients, { ingredientId: "ing-arroz", quantityG: 50 }] };
    const result = await saveTeamRecipeWith(deps, dup, null);
    expect(result).toEqual({ ok: false, error: "Ingrediente repetido na receita" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/server/services/recipes.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/server/services/recipes.ts`**

```ts
import { computeRecipeTotals } from "@/lib/nutrition";
import type { ActionResult, IngredientMacros } from "@/lib/types";
import type { RecipeInputData } from "@/lib/validation/recipe";
import { prisma } from "@/server/db";

export type RecipePersistData = RecipeInputData & {
  id: string | null;
  status: "APPROVED";
  origin: "TEAM";
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
};

export type RecipeDeps = {
  findIngredientMacros: (ids: string[]) => Promise<(IngredientMacros & { id: string })[]>;
  persist: (data: RecipePersistData) => Promise<{ id: string }>;
};

export async function saveTeamRecipeWith(
  deps: RecipeDeps,
  input: RecipeInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  const ids = input.ingredients.map((i) => i.ingredientId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Ingrediente repetido na receita" };
  }

  const macros = await deps.findIngredientMacros(ids);
  const byId = new Map(macros.map((m) => [m.id, m]));
  for (const ingredientId of ids) {
    if (!byId.has(ingredientId)) {
      return { ok: false, error: `Ingrediente não encontrado: ${ingredientId}` };
    }
  }

  const totals = computeRecipeTotals(
    input.ingredients.map((i) => ({ quantityG: i.quantityG, ingredient: byId.get(i.ingredientId)! })),
    input.servings,
  );

  const saved = await deps.persist({
    ...input,
    id,
    status: "APPROVED",
    origin: "TEAM",
    kcalPerServing: totals.kcal,
    proteinGPerServing: totals.proteinG,
    carbsGPerServing: totals.carbsG,
    fatGPerServing: totals.fatG,
  });
  return { ok: true, data: { id: saved.id } };
}

export function saveTeamRecipe(
  input: RecipeInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  return saveTeamRecipeWith(
    {
      findIngredientMacros: (ids) =>
        prisma.ingredient.findMany({
          where: { id: { in: ids } },
          select: { id: true, kcalPer100g: true, proteinGPer100g: true, carbsGPer100g: true, fatGPer100g: true },
        }),
      persist: async (data) => {
        const recipeFields = {
          name: data.name,
          instructions: data.instructions,
          servings: data.servings,
          suitableMealTypes: data.suitableMealTypes,
          status: data.status,
          origin: data.origin,
          kcalPerServing: data.kcalPerServing,
          proteinGPerServing: data.proteinGPerServing,
          carbsGPerServing: data.carbsGPerServing,
          fatGPerServing: data.fatGPerServing,
        };
        const ingredientRows = data.ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          quantityG: i.quantityG,
        }));
        if (data.id) {
          await prisma.$transaction([
            prisma.recipeIngredient.deleteMany({ where: { recipeId: data.id } }),
            prisma.recipe.update({
              where: { id: data.id },
              data: { ...recipeFields, ingredients: { create: ingredientRows } },
            }),
          ]);
          return { id: data.id };
        }
        const created = await prisma.recipe.create({
          data: { ...recipeFields, ingredients: { create: ingredientRows } },
          select: { id: true },
        });
        return { id: created.id };
      },
    },
    input,
    id,
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/server/services/recipes.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Criar `src/app/admin/recipes/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { recipeSchema } from "@/lib/validation/recipe";
import { requireAdmin } from "@/server/auth/guards";
import { saveTeamRecipe } from "@/server/services/recipes";

export async function saveRecipeAction(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = recipeSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await saveTeamRecipe(parsed.data, id);
  if (result.ok) revalidatePath("/admin/recipes");
  return result;
}
```

(O composer é um Client Component com estado estruturado — a action recebe `payload` JSON, não FormData.)

- [ ] **Step 6: Criar `src/app/api/admin/recipes/search/route.ts`** (usado pelo editor de plano)

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = await prisma.recipe.findMany({
    where: { status: "APPROVED", name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      servings: true,
      kcalPerServing: true,
      proteinGPerServing: true,
      carbsGPerServing: true,
      fatGPerServing: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return NextResponse.json({ items });
}
```

- [ ] **Step 7: Verificar e commitar**

Run: `npm run test` e `npm run build` → Expected: verdes.

```bash
git add src/server/services/recipes.ts src/server/services/recipes.test.ts src/app/admin/recipes/actions.ts src/app/api/admin/recipes/search
git commit -m "feat: servico e actions de receitas com recalculo de macros (TDD)"
```

**Critérios de aceite (Codex):** testes passam; totais por porção SEMPRE recalculados no persist (nunca aceitos do payload); update substitui os ingredientes em transação; busca só retorna `APPROVED`.

---

### Task 5: Serviço e actions de Pacientes — [CODEX]

**Files:**
- Create: `src/server/services/patients.ts`
- Test: `src/server/services/patients.test.ts`
- Create: `src/app/admin/patients/actions.ts`

- [ ] **Step 1: Escrever testes (falhando)**

`src/server/services/patients.test.ts`:

```ts
import { compareSync } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { createPatientWith, resetPatientPasswordWith, type PatientCreateDeps } from "./patients";

const input = {
  name: "Ana Silva",
  email: "Ana@Example.com ",
  birthDate: null,
  sex: null,
  teamNotes: null,
};

function makeDeps() {
  const created: { email: string; passwordHash: string }[] = [];
  const deps: PatientCreateDeps = {
    findUserByEmail: async () => null,
    createPatient: async (data) => {
      created.push(data);
      return { id: "u1" };
    },
  };
  return { deps, created };
}

describe("createPatientWith", () => {
  it("cria paciente com email normalizado e senha provisória que confere com o hash", async () => {
    const { deps, created } = makeDeps();
    const result = await createPatientWith(deps, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(created[0].email).toBe("ana@example.com");
    expect(result.data.tempPassword).toHaveLength(12);
    expect(compareSync(result.data.tempPassword, created[0].passwordHash)).toBe(true);
  });

  it("recusa email já cadastrado", async () => {
    const { deps } = makeDeps();
    deps.findUserByEmail = async () => ({ id: "outro" });
    const result = await createPatientWith(deps, input);
    expect(result).toEqual({ ok: false, error: "Já existe um usuário com esse email" });
  });
});

describe("resetPatientPasswordWith", () => {
  it("gera nova senha provisória e marca mustChangePassword", async () => {
    let saved: { passwordHash: string; mustChangePassword: boolean } | null = null;
    const result = await resetPatientPasswordWith(
      { updatePassword: async (_id, data) => { saved = data; } },
      "u1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !saved) return;
    expect(saved.mustChangePassword).toBe(true);
    expect(compareSync(result.data.tempPassword, saved.passwordHash)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/server/services/patients.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/server/services/patients.ts`**

```ts
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { ActionResult } from "@/lib/types";
import type { PatientCreateData, PatientUpdateData } from "@/lib/validation/patient";
import { prisma } from "@/server/db";

// Sem caracteres ambíguos (0/O, 1/l/I) — a senha é digitada pelo paciente.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

export type PatientCreateDeps = {
  findUserByEmail: (email: string) => Promise<{ id: string } | null>;
  createPatient: (data: {
    email: string;
    name: string;
    passwordHash: string;
    birthDate: Date | null;
    sex: "MALE" | "FEMALE" | null;
    teamNotes: string | null;
  }) => Promise<{ id: string }>;
};

export async function createPatientWith(
  deps: PatientCreateDeps,
  input: PatientCreateData,
): Promise<ActionResult<{ id: string; tempPassword: string }>> {
  const email = input.email.trim().toLowerCase();
  const existing = await deps.findUserByEmail(email);
  if (existing) return { ok: false, error: "Já existe um usuário com esse email" };

  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 12);
  const created = await deps.createPatient({
    email,
    name: input.name.trim(),
    passwordHash,
    birthDate: input.birthDate,
    sex: input.sex,
    teamNotes: input.teamNotes,
  });
  return { ok: true, data: { id: created.id, tempPassword } };
}

export type PasswordResetDeps = {
  updatePassword: (
    userId: string,
    data: { passwordHash: string; mustChangePassword: boolean },
  ) => Promise<void>;
};

export async function resetPatientPasswordWith(
  deps: PasswordResetDeps,
  userId: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 12);
  await deps.updatePassword(userId, { passwordHash, mustChangePassword: true });
  return { ok: true, data: { tempPassword } };
}

// ---- wrappers de produção ----

export function createPatient(input: PatientCreateData) {
  return createPatientWith(
    {
      findUserByEmail: (email) => prisma.user.findUnique({ where: { email }, select: { id: true } }),
      createPatient: async (data) => {
        const user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
            role: "PATIENT",
            mustChangePassword: true,
            patientProfile: {
              create: { birthDate: data.birthDate, sex: data.sex, teamNotes: data.teamNotes },
            },
          },
          select: { id: true },
        });
        return user;
      },
    },
    input,
  );
}

export function resetPatientPassword(userId: string) {
  return resetPatientPasswordWith(
    {
      updatePassword: async (id, data) => {
        await prisma.user.update({ where: { id, role: "PATIENT" }, data });
      },
    },
    userId,
  );
}

export async function updatePatient(
  userId: string,
  input: PatientUpdateData,
): Promise<ActionResult> {
  await prisma.user.update({
    where: { id: userId, role: "PATIENT" },
    data: {
      name: input.name.trim(),
      active: input.active,
      patientProfile: {
        update: {
          birthDate: input.birthDate,
          sex: input.sex,
          teamNotes: input.teamNotes,
          dailyAiLimit: input.dailyAiLimit,
        },
      },
    },
  });
  return { ok: true, data: undefined };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/server/services/patients.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Criar `src/app/admin/patients/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { patientCreateSchema, patientUpdateSchema } from "@/lib/validation/patient";
import { requireAdmin } from "@/server/auth/guards";
import { createPatient, resetPatientPassword, updatePatient } from "@/server/services/patients";

export async function createPatientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; tempPassword: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = patientCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    birthDate: formData.get("birthDate") || null,
    sex: formData.get("sex") || null,
    teamNotes: formData.get("teamNotes") || null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const result = await createPatient(parsed.data);
  if (result.ok) revalidatePath("/admin/patients");
  return result;
}

export async function updatePatientAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = patientUpdateSchema.safeParse({
    name: formData.get("name"),
    birthDate: formData.get("birthDate") || null,
    sex: formData.get("sex") || null,
    teamNotes: formData.get("teamNotes") || null,
    dailyAiLimit: formData.get("dailyAiLimit"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const result = await updatePatient(userId, parsed.data);
  if (result.ok) {
    revalidatePath("/admin/patients");
    revalidatePath(`/admin/patients/${userId}`);
  }
  return result;
}

export async function resetPatientPasswordAction(
  userId: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };
  return resetPatientPassword(userId);
}
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm run test` e `npm run build` → Expected: verdes.

```bash
git add src/server/services/patients.ts src/server/services/patients.test.ts src/app/admin/patients/actions.ts
git commit -m "feat: servico e actions de pacientes com senha provisoria (TDD)"
```

**Critérios de aceite (Codex):** testes passam; senha provisória de 12 caracteres sem ambíguos, nunca logada nem persistida em claro, retornada UMA vez no resultado; criação de User+PatientProfile é atômica (nested create); updates usam `where: { id, role: "PATIENT" }` (nunca tocar admins).

---

### Task 6: Serviço e action do Plano Alimentar — [CODEX]

**Files:**
- Create: `src/server/services/meal-plans.ts`
- Test: `src/server/services/meal-plans.test.ts`
- Create: `src/app/admin/patients/[id]/plan/actions.ts`

- [ ] **Step 1: Escrever testes (falhando)**

`src/server/services/meal-plans.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diffSlots, saveMealPlanWith, type MealPlanDeps } from "./meal-plans";
import type { MealPlanData } from "@/lib/validation/meal-plan";

const slotBase = {
  name: "Almoço",
  order: 0,
  mealType: "LUNCH" as const,
  timeHint: null,
  kcal: 650,
  proteinG: 45,
  carbsG: 70,
  fatG: 20,
  items: [{ ingredientId: "ing-1", quantityG: 100, recipeId: null, servings: null }],
};

const plan: MealPlanData = {
  dailyKcal: 1800,
  dailyProteinG: 130,
  dailyCarbsG: 180,
  dailyFatG: 60,
  slots: [{ ...slotBase, id: null }],
};

describe("diffSlots", () => {
  it("separa criação, atualização e remoção", () => {
    const incoming = [
      { ...slotBase, id: "s1" },
      { ...slotBase, id: null, name: "Jantar" },
    ];
    const diff = diffSlots(["s1", "s2"], incoming);
    expect(diff.toUpdate.map((s) => s.id)).toEqual(["s1"]);
    expect(diff.toCreate.map((s) => s.name)).toEqual(["Jantar"]);
    expect(diff.toDeleteIds).toEqual(["s2"]);
  });

  it("recusa slot com id que não pertence ao plano", () => {
    expect(() => diffSlots(["s1"], [{ ...slotBase, id: "intruso" }])).toThrow();
  });
});

describe("saveMealPlanWith", () => {
  it("cria plano novo quando o paciente não tem plano ativo", async () => {
    const calls: string[] = [];
    const deps: MealPlanDeps = {
      getActivePlan: async () => null,
      createPlanWithSlots: async () => {
        calls.push("create");
        return { id: "p1" };
      },
      applyPlanUpdate: async () => {
        calls.push("update");
      },
    };
    const result = await saveMealPlanWith(deps, "patient-1", plan);
    expect(result).toEqual({ ok: true, data: { id: "p1" } });
    expect(calls).toEqual(["create"]);
  });

  it("atualiza plano existente com o diff de slots", async () => {
    let received: unknown = null;
    const deps: MealPlanDeps = {
      getActivePlan: async () => ({ id: "p1", slotIds: ["s1"] }),
      createPlanWithSlots: async () => {
        throw new Error("não deve criar");
      },
      applyPlanUpdate: async (planId, _targets, diff) => {
        received = { planId, deletes: diff.toDeleteIds.length };
      },
    };
    const result = await saveMealPlanWith(deps, "patient-1", {
      ...plan,
      slots: [{ ...slotBase, id: null, name: "Café" }],
    });
    expect(result.ok).toBe(true);
    expect(received).toEqual({ planId: "p1", deletes: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/server/services/meal-plans.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/server/services/meal-plans.ts`**

```ts
import type { ActionResult } from "@/lib/types";
import type { MealPlanData, MealSlotData } from "@/lib/validation/meal-plan";
import { prisma } from "@/server/db";

export type SlotDiff = {
  toCreate: MealSlotData[];
  toUpdate: (MealSlotData & { id: string })[];
  toDeleteIds: string[];
};

export function diffSlots(existingIds: string[], incoming: MealSlotData[]): SlotDiff {
  const existing = new Set(existingIds);
  const toUpdate: (MealSlotData & { id: string })[] = [];
  const toCreate: MealSlotData[] = [];

  for (const slot of incoming) {
    if (slot.id) {
      if (!existing.has(slot.id)) throw new Error(`Slot desconhecido: ${slot.id}`);
      toUpdate.push({ ...slot, id: slot.id });
    } else {
      toCreate.push(slot);
    }
  }
  const incomingIds = new Set(incoming.map((s) => s.id).filter(Boolean));
  const toDeleteIds = existingIds.filter((id) => !incomingIds.has(id));
  return { toCreate, toUpdate, toDeleteIds };
}

type PlanTargets = Pick<MealPlanData, "dailyKcal" | "dailyProteinG" | "dailyCarbsG" | "dailyFatG">;

export type MealPlanDeps = {
  getActivePlan: (patientId: string) => Promise<{ id: string; slotIds: string[] } | null>;
  createPlanWithSlots: (patientId: string, plan: MealPlanData) => Promise<{ id: string }>;
  applyPlanUpdate: (planId: string, targets: PlanTargets, diff: SlotDiff) => Promise<void>;
};

export async function saveMealPlanWith(
  deps: MealPlanDeps,
  patientId: string,
  input: MealPlanData,
): Promise<ActionResult<{ id: string }>> {
  const active = await deps.getActivePlan(patientId);

  if (!active) {
    const created = await deps.createPlanWithSlots(patientId, input);
    return { ok: true, data: { id: created.id } };
  }

  let diff: SlotDiff;
  try {
    diff = diffSlots(active.slotIds, input.slots);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Slots inválidos" };
  }

  await deps.applyPlanUpdate(
    active.id,
    {
      dailyKcal: input.dailyKcal,
      dailyProteinG: input.dailyProteinG,
      dailyCarbsG: input.dailyCarbsG,
      dailyFatG: input.dailyFatG,
    },
    diff,
  );
  return { ok: true, data: { id: active.id } };
}

// ---- wrapper de produção ----

function slotFields(s: MealSlotData) {
  return {
    name: s.name,
    order: s.order,
    mealType: s.mealType,
    timeHint: s.timeHint,
    kcal: s.kcal,
    proteinG: s.proteinG,
    carbsG: s.carbsG,
    fatG: s.fatG,
  };
}

function itemRows(s: MealSlotData) {
  return s.items.map((i) => ({
    ingredientId: i.ingredientId,
    quantityG: i.quantityG,
    recipeId: i.recipeId,
    servings: i.servings,
  }));
}

export function saveMealPlan(patientId: string, input: MealPlanData) {
  return saveMealPlanWith(
    {
      getActivePlan: async (pid) => {
        const p = await prisma.mealPlan.findFirst({
          where: { patientId: pid, active: true },
          select: { id: true, slots: { select: { id: true } } },
        });
        return p ? { id: p.id, slotIds: p.slots.map((s) => s.id) } : null;
      },
      createPlanWithSlots: async (pid, plan) => {
        const created = await prisma.mealPlan.create({
          data: {
            patientId: pid,
            active: true,
            dailyKcal: plan.dailyKcal,
            dailyProteinG: plan.dailyProteinG,
            dailyCarbsG: plan.dailyCarbsG,
            dailyFatG: plan.dailyFatG,
            slots: {
              create: plan.slots.map((s) => ({ ...slotFields(s), items: { create: itemRows(s) } })),
            },
          },
          select: { id: true },
        });
        return created;
      },
      applyPlanUpdate: async (planId, targets, diff) => {
        await prisma.$transaction([
          prisma.mealPlan.update({ where: { id: planId }, data: targets }),
          ...diff.toDeleteIds.map((id) => prisma.mealSlot.delete({ where: { id } })),
          ...diff.toUpdate.map((s) =>
            prisma.mealSlot.update({
              where: { id: s.id },
              data: { ...slotFields(s), items: { deleteMany: {}, create: itemRows(s) } },
            }),
          ),
          ...diff.toCreate.map((s) =>
            prisma.mealSlot.create({
              data: { ...slotFields(s), mealPlanId: planId, items: { create: itemRows(s) } },
            }),
          ),
        ]);
      },
    },
    patientId,
    input,
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/server/services/meal-plans.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Criar `src/app/admin/patients/[id]/plan/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { mealPlanSchema } from "@/lib/validation/meal-plan";
import { requireAdmin } from "@/server/auth/guards";
import { saveMealPlan } from "@/server/services/meal-plans";

export async function saveMealPlanAction(
  patientId: string,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Sem permissão" };

  const parsed = mealPlanSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await saveMealPlan(patientId, parsed.data);
  if (result.ok) revalidatePath(`/admin/patients/${patientId}/plan`);
  return result;
}
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm run test` e `npm run build` → Expected: verdes.

```bash
git add src/server/services/meal-plans.ts src/server/services/meal-plans.test.ts "src/app/admin/patients/[id]/plan/actions.ts"
git commit -m "feat: servico e action do plano alimentar com diff de slots (TDD)"
```

**Critérios de aceite (Codex):** testes passam; update de plano roda em UMA transação; slot com id estranho ao plano é recusado (proteção cross-patient); itens são substituídos por slot (deleteMany + create); nenhum cálculo de macro acontece aqui (metas são entrada da equipe).

---

### Task 7: Tokens da marca + shell do admin com navegação — [CLAUDE]

Estilo do admin nesta fase: utilitário desktop-first com os tokens da marca (não é o design system do paciente; é o "arrumado o suficiente" para a equipe trabalhar). Some o emerald.

**Files:**
- Modify: `src/app/globals.css` (bloco `@theme` com tokens)
- Modify: `src/app/layout.tsx` (fontes Manrope + Inter via `next/font/google`)
- Modify: `src/app/admin/layout.tsx` (sidebar com navegação)

**Especificação:**

- [ ] **Step 1:** `@theme` no `globals.css` com os tokens da marca:

```css
@theme {
  --color-brand-600: #A65922;
  --color-brand-500: #BF6B2C;
  --color-brand-100: #F6E3CF;
  --color-caramel-500: #C89B62;
  --color-caramel-200: #E9CFA3;
  --color-cream-50: #FFFCF6;
  --color-cream-100: #F4EDE0;
  --color-cream-200: #EDE3CE;
  --color-ink-900: #2B2622;
  --color-ink-500: #6E6354;
  --color-ink-300: #93876F;
  --color-charcoal-900: #241D17;
  --color-line-200: #E6DAC4;
  --font-display: var(--font-manrope);
  --font-body: var(--font-inter);
}
```

- [ ] **Step 2:** `layout.tsx` raiz: carregar `Manrope` (`variable: "--font-manrope"`) e `Inter` (`--font-inter`) de `next/font/google`, aplicar as variáveis no `<html>`, `lang="pt-BR"`, metadata title "Manuela Giglio · Nutrição".
- [ ] **Step 3:** `admin/layout.tsx`: sidebar fixa à esquerda (creme, borda `line-200`) com logo textual "MANUELA GIGLIO" (caps, tracking largo, Manrope) e navegação: Visão geral (`/admin`), Pacientes (`/admin/patients`), Receitas (`/admin/recipes`), Ingredientes (`/admin/ingredients`); item ativo com texto `brand-500` e fundo `brand-100`; usuário + botão Sair no rodapé da sidebar. Área de conteúdo com `max-w-6xl`, fundo `cream-100`. Manter os 3 redirects de sessão existentes intactos.
- [ ] **Step 4:** Run `npm run build` (verde) + verificação visual no dev server (sidebar, nav ativa, logout).
- [ ] **Step 5:** Commit: `feat: tokens da marca e shell do admin com navegacao`

---

### Task 8: UI de Ingredientes — [CLAUDE]

Depende das Tasks 1, 3, 7.

**Files:**
- Create: `src/app/admin/ingredients/page.tsx` (Server Component: busca via `searchParams.q`, tabela)
- Create: `src/app/admin/ingredients/ingredient-form.tsx` (Client Component reutilizado por new/edit)
- Create: `src/app/admin/ingredients/new/page.tsx`
- Create: `src/app/admin/ingredients/[id]/page.tsx` (edição)

**Especificação:**

- [ ] **Step 1:** Lista: input de busca (form GET), tabela com Nome / Fonte (badge TACO·TBCA·CUSTOM) / kcal / P / C / G por 100 g, paginação simples (50 por página via `searchParams.page`, `prisma.ingredient.findMany` com `skip/take` + `count`). Linha clicável → edição. Botão "Novo ingrediente".
- [ ] **Step 2:** Form (client, `useActionState`-style com `useTransition` + `saveIngredientAction`): campos do `ingredientSchema`, erros inline, sucesso redireciona para a lista (`useRouter`). Na edição de ingrediente TACO/TBCA, mostrar aviso "Ingrediente de tabela oficial — edite apenas para corrigir erro de importação".
- [ ] **Step 3:** Verificação manual: criar CUSTOM, editar, buscar "arroz" (TACO importado aparece), duplicado recusado com mensagem.
- [ ] **Step 4:** `npm run test` + `npm run build` verdes. Commit: `feat: telas de ingredientes no admin`

---

### Task 9: UI de Receitas com composer de macros ao vivo — [CLAUDE]

Depende das Tasks 1, 2, 3, 4, 7.

**Files:**
- Create: `src/app/admin/recipes/page.tsx` (lista com filtro por status e tipo de refeição)
- Create: `src/app/admin/recipes/recipe-form.tsx` (Client Component — o composer)
- Create: `src/app/admin/recipes/new/page.tsx`
- Create: `src/app/admin/recipes/[id]/page.tsx` (edição; carrega receita + ingredientes e passa como `initial` ao composer)

**Especificação do composer (o componente crítico da fase):**

- [ ] **Step 1:** Estado do composer:

```ts
type ComposerIngredient = {
  ingredientId: string;
  name: string;               // exibição
  macros: IngredientMacros;   // para cálculo ao vivo
  quantityG: number;
};
// totais ao vivo, recalculados a cada mudança:
const totals = useMemo(
  () => (ingredients.length && servings > 0
    ? computeRecipeTotals(ingredients.map(i => ({ quantityG: i.quantityG, ingredient: i.macros })), servings)
    : null),
  [ingredients, servings],
);
```

A MESMA função `computeRecipeTotals` de `@/lib/nutrition` roda no client (preview) e no servidor (autoridade) — nunca duplicar a conta no componente.

- [ ] **Step 2:** Busca de ingrediente inline: input com debounce (300 ms) → `GET /api/admin/ingredients/search?q=` → dropdown de resultados → clique adiciona com `quantityG: 100` editável. Ingrediente já adicionado aparece desabilitado no dropdown.
- [ ] **Step 3:** Campos: nome, rendimento (porções), tipos de refeição (checkboxes com `MEAL_TYPE_LABELS`), modo de preparo (textarea), lista de ingredientes (linha: nome · input gramas · macros da linha via `scalePer100` · remover). Painel lateral fixo com totais por porção ao vivo (kcal grande, P/C/G) no estilo dos tokens.
- [ ] **Step 4:** Salvar: `saveRecipeAction(id, payload)` com payload estruturado (não FormData); `useTransition` para pending; erro da action exibido; sucesso → lista.
- [ ] **Step 5:** Lista: tabela Nome / Tipos / kcal por porção / Status (badge) / Origem; filtros por status e mealType via `searchParams`.
- [ ] **Step 6:** Verificação manual: criar receita com 2 ingredientes TACO, conferir totais ao vivo contra cálculo de cabeça, salvar, reabrir para editar, mudar gramas e confirmar recálculo persistido na lista.
- [ ] **Step 7:** `npm run test` + `npm run build` verdes. Commit: `feat: telas de receitas com composer e macros ao vivo`

---

### Task 10: UI de Pacientes — [CLAUDE]

Depende das Tasks 1, 5, 7.

**Files:**
- Create: `src/app/admin/patients/page.tsx` (lista: nome, email, status ativo, plano ativo sim/não, limite IA)
- Create: `src/app/admin/patients/new/page.tsx` + `patient-create-form.tsx`
- Create: `src/app/admin/patients/[id]/page.tsx` (detalhe com abas) + `patient-edit-form.tsx`

**Especificação:**

- [ ] **Step 1:** Criação: form com campos do `patientCreateSchema`. **No sucesso, mostrar a senha provisória UMA única vez** em um painel destacado (fundo `brand-100`, fonte mono, botão "copiar") com aviso "Anote agora — ela não será exibida novamente. O paciente trocará no primeiro acesso."
- [ ] **Step 2:** Detalhe com abas (`searchParams.tab`): **Dados** (edit form: nome, nascimento, sexo, notas da equipe, `dailyAiLimit`, toggle ativo) e **Plano alimentar** (link/embed da Task 11). Abas Avaliações/Diário/Materiais/Evolução aparecem desabilitadas com "Fase 5".
- [ ] **Step 3:** Botão "Redefinir senha" no detalhe: confirma via `confirm()` nativo, chama `resetPatientPasswordAction`, mostra a nova senha provisória no mesmo painel de senha da criação.
- [ ] **Step 4:** Verificação manual: criar paciente → copiar senha → logout → login como paciente (força troca de senha — fluxo da Fase 1 continua ok) → login admin de novo → desativar paciente → login do paciente recusado.
- [ ] **Step 5:** `npm run test` + `npm run build` verdes. Commit: `feat: telas de gestao de pacientes no admin`

---

### Task 11: Editor de Plano Alimentar — [CLAUDE]

Depende das Tasks 1, 2, 4, 6, 7, 10. A tela mais complexa da fase.

**Files:**
- Create: `src/app/admin/patients/[id]/plan/page.tsx` (Server Component: carrega plano ativo com slots+items e dados de exibição dos itens)
- Create: `src/app/admin/patients/[id]/plan/plan-editor.tsx` (Client Component)

**Especificação:**

- [ ] **Step 1:** Estado do editor (espelha `MealPlanData`, com dados de exibição extras):

```ts
type EditorItem = MealSlotItemData & {
  label: string;          // nome do ingrediente/receita
  macros: MacroTotals;    // macros calculados do item (exibição)
};
type EditorSlot = Omit<MealSlotData, "items"> & { key: string; items: EditorItem[] };
```

Macros de item: ingrediente → `scalePer100(macros, quantityG)`; receita → `scaleServing(perServing, servings)` — sempre de `@/lib/nutrition`.

- [ ] **Step 2:** Cabeçalho: 4 inputs de metas diárias + linha de conferência ao vivo: "Refeições somam X kcal · Δ vs meta diária" (mesma conta para P/C/G, compacta). Delta ≠ 0 é aviso âmbar, nunca bloqueio.
- [ ] **Step 3:** Slots: cards ordenados com nome, select de `mealType` (labels PT), horário opcional, 4 inputs de meta, botões subir/descer (troca `order`) e remover. Botão "Adicionar refeição" cria slot com defaults (nome pelo label do mealType, metas 0).
- [ ] **Step 4:** Dieta base por slot: botões "+ Ingrediente" / "+ Receita" abrem busca inline (mesmo padrão de debounce da Task 9, apontando para `/api/admin/ingredients/search` e `/api/admin/recipes/search`); item adicionado vira linha com input de gramas/porções + macros ao vivo + remover. Rodapé do slot: "dieta base: X kcal · alvo Y kcal".
- [ ] **Step 5:** Salvar plano inteiro: monta `MealPlanData` (descartando `label`/`macros`/`key`), chama `saveMealPlanAction(patientId, payload)`; pending + erro + sucesso ("Plano salvo") visíveis; recarrega dados do servidor após sucesso (`router.refresh()`).
- [ ] **Step 6:** Paciente sem plano: editor abre com 4 slots default (Café da manhã, Almoço, Lanche da tarde, Jantar) e metas zeradas.
- [ ] **Step 7:** Verificação manual: montar plano completo para o paciente de teste (metas + 4 refeições + dieta base com 1 ingrediente e 1 receita), salvar, recarregar página (persistiu), remover um slot + salvar, conferir no banco que os slots/itens batem.
- [ ] **Step 8:** `npm run test` + `npm run build` verdes. Commit: `feat: editor de plano alimentar com dieta base e conferencia de metas`

---

### Task 12: Verificação final da Fase 2 — [CLAUDE]

- [ ] **Step 1:** `npm run test` → todos os testes (Fase 1 + 2) passam.
- [ ] **Step 2:** `npm run build` → verde, sem warnings de depreciação.
- [ ] **Step 3:** Fluxo ponta a ponta no dev server:
  1. Login admin → sidebar navega entre as 4 seções.
  2. Ingredientes: buscar TACO, criar CUSTOM.
  3. Receitas: criar receita com os dois, totais ao vivo = totais persistidos.
  4. Pacientes: criar paciente, ver senha provisória uma vez, redefinir senha.
  5. Plano: montar plano com dieta base, salvar, recarregar, editar, salvar.
  6. Login como o paciente criado: troca de senha forçada funciona; `/admin` bloqueado.
- [ ] **Step 4:** Atualizar `PRD.md` (checkboxes da Fase 2) e `AGENTS.md` (plano da fase atual → este arquivo).
- [ ] **Step 5:** Commit final: `docs: fase 2 concluida`

---

## Ordem de execução e paralelismo

```
Task 1 (CLAUDE) → Task 2 (CODEX) → Task 3 (CODEX) → Task 4 (CODEX) → Task 5 (CODEX) → Task 6 (CODEX)
Task 7 (CLAUDE) — pode rodar em paralelo com Tasks 2–6 (não compartilha arquivos)
Tasks 8–11 (CLAUDE) — após os respectivos backends; 8 e 10 podem intercalar; 11 por último
Task 12 (CLAUDE) — fecha a fase
```

## Definition of Done da Fase 2

- [ ] `npm run test` e `npm run build` verdes.
- [ ] Nenhum macro no banco veio de input manual de receita — só de `computeRecipeTotals`.
- [ ] Senha provisória exibida uma única vez; nunca em log.
- [ ] Editor de plano salva e recarrega com fidelidade (slots, ordem, itens).
- [ ] Emerald removido do admin (tokens da marca em uso).
- [ ] Contratos compartilhados intactos para o frontend e para as fases seguintes.
