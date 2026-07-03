# Fase 1 (Fundação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundação do app de nutrição: projeto Next.js configurado, schema Prisma completo migrado no PostgreSQL, autenticação com roles (admin/paciente) funcionando ponta a ponta, e banco de ingredientes populado com a tabela TACO.

**Architecture:** Monolito Next.js (App Router) com camada de serviços testável em `src/server/services/`. Auth.js (NextAuth v5) com provider de credenciais e sessão JWT; middleware protege `/admin` (ADMIN) e `/app` (PATIENT). Ingredientes verificados importados da TACO via script idempotente. Ver design doc: `docs/superpowers/specs/2026-07-03-nutrition-app-design.md`.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind CSS v4, PostgreSQL (Render), Prisma, Auth.js v5 (`next-auth@beta`), bcryptjs, Zod, Vitest, tsx.

**Executores:**
- **[CLAUDE]** = frontend/orquestração — executado por Claude nesta ou em próximas sessões.
- **[CODEX]** = backend — tarefa escrita para ser entregue ao Codex como instrução autocontida. Codex deve seguir os passos na ordem, sem pular os passos de teste.

**Pré-requisito (usuário):** `DATABASE_URL` do PostgreSQL no Render (connection string externa) disponível antes da Task 3.

**Convenções para todos os executores:**
- TDD nos serviços: escrever o teste, vê-lo falhar, implementar, vê-lo passar, commitar.
- Commits pequenos e frequentes, mensagens em português, prefixos `feat:`/`chore:`/`test:`.
- Nunca commitar `.env`.

---

### Task 1: Scaffold do projeto Next.js + Vitest — [CLAUDE]

**Files:**
- Create: projeto Next.js na raiz (via create-next-app em pasta temporária)
- Create: `vitest.config.ts`, `.env.example`
- Modify: `package.json` (scripts), `.gitignore`

- [ ] **Step 1: Scaffold em pasta temporária** (a raiz já tem `docs/`, `PROJECT_BRIEF.md` e `.git`, que o create-next-app rejeita)

Run (PowerShell):
```powershell
npx create-next-app@latest tmp-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Mover o scaffold para a raiz e limpar**

```powershell
if (Test-Path tmp-scaffold/.git) { Remove-Item -Recurse -Force tmp-scaffold/.git }
Get-ChildItem -Force tmp-scaffold | Move-Item -Destination .
Remove-Item tmp-scaffold
```

Verificar que `.gitignore` do scaffold inclui `.env*` e `node_modules` (incluir se faltar).

- [ ] **Step 3: Instalar dependências de teste e utilitários**

```powershell
npm install zod
npm install -D vitest tsx
```

- [ ] **Step 4: Criar `vitest.config.ts`**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 5: Adicionar script de teste ao `package.json`**

Em `"scripts"`, adicionar: `"test": "vitest run"`.

- [ ] **Step 6: Criar `.env.example`**

```
# PostgreSQL (Render) — connection string externa
DATABASE_URL="postgresql://user:password@host.render.com/dbname"

# Auth.js — gerar com: openssl rand -base64 32
AUTH_SECRET=""

# Seed do primeiro admin
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="troque-esta-senha"
ADMIN_NAME="Admin"
```

- [ ] **Step 7: Verificar que o app sobe e os testes rodam**

Run: `npm run test` → Expected: "No test files found" sem erro de config (exit 0 com `--passWithNoTests`; se falhar por isso, adicionar `passWithNoTests: true` ao `vitest.config.ts`).
Run: `npm run dev` → abrir http://localhost:3000, ver a página default do Next. Encerrar.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind v4 + Vitest"
```

---

### Task 2: Contratos compartilhados (tipos + Zod) — [CLAUDE]

Contratos definidos antes das tarefas paralelas para frontend e backend integrarem sem retrabalho.

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/validation/auth.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Criar `src/lib/types.ts`**

```ts
// Tipos de domínio compartilhados entre frontend e backend.
// Espelham os enums do Prisma sem importar @prisma/client
// (necessário em código edge-safe como o middleware).

export type Role = "ADMIN" | "PATIENT";

export type MacroTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};
```

- [ ] **Step 2: Criar `src/lib/validation/auth.ts`**

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email inválido"), // zod v4 (o template do Next 16 já traz zod ^4)
  password: z.string().min(1, "Informe a senha"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
```

- [ ] **Step 3: Criar `src/types/next-auth.d.ts`** (augmentation da sessão com role)

```ts
import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    mustChangePassword?: boolean;
  }
}
```

Nota: `next-auth` só será instalado na Task 7; o `.d.ts` pode acusar erro de tipo até lá — aceitável.

- [ ] **Step 4: Commit**

```bash
git add src/lib src/types
git commit -m "feat: contratos compartilhados (tipos de domínio e schemas de auth)"
```

---

### Task 3: Prisma + schema completo + migração — [CODEX]

Schema completo do design doc (seção 4). Modela TODAS as entidades do MVP desde já, para as fases seguintes só adicionarem código, não migrações estruturais grandes.

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json`

**Pré-requisito:** `.env` na raiz com `DATABASE_URL` válida (copiar de `.env.example` e preencher — NÃO commitar).

> **Prisma 7:** o projeto usa Prisma 7 (não 6). Diferenças relevantes: o generator é `prisma-client` (gera o client em `src/generated/prisma`, fora do node_modules), a URL do banco vive em `prisma.config.ts` (não no schema), e o client roda com driver adapter (`@prisma/adapter-pg`). O CLI não lê `.env` sozinho — o `prisma.config.ts` importa `dotenv/config`.

- [ ] **Step 1: Instalar Prisma 7 + adapter PostgreSQL**

```powershell
npm install -D prisma @types/pg
npm install @prisma/client @prisma/adapter-pg pg dotenv
```

- [ ] **Step 2: Criar `prisma.config.ts` na raiz**

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

- [ ] **Step 3: Criar `prisma/schema.prisma` com o schema completo**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  ADMIN
  PATIENT
}

enum Sex {
  MALE
  FEMALE
}

enum IngredientSource {
  TACO
  TBCA
  CUSTOM
}

enum MealType {
  BREAKFAST
  MORNING_SNACK
  LUNCH
  AFTERNOON_SNACK
  DINNER
  SUPPER
}

enum RecipeStatus {
  APPROVED
  PENDING_REVIEW
  PRIVATE
}

enum RecipeOrigin {
  TEAM
  AI_GENERATED
  EXTERNAL
}

enum MealLogStatus {
  COMPLETED
  SKIPPED
}

enum MealLogType {
  PLAN
  AI_SUGGESTION
  EXTERNAL_RECIPE
  FREE_ENTRY
}

enum AiJobType {
  SUGGEST
  GENERATE
  EVALUATE_EXTERNAL
}

enum AiJobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum AssessmentSource {
  TEAM
  PATIENT
}

enum MaterialType {
  PDF
  IMAGE
  LINK
}

model User {
  id                 String   @id @default(cuid())
  email              String   @unique
  name               String
  passwordHash       String
  role               Role
  active             Boolean  @default(true)
  mustChangePassword Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  patientProfile      PatientProfile?
  mealPlans           MealPlan[]
  mealLogs            MealLog[]
  mealSuggestions     MealSuggestion[]
  aiJobs              AiJob[]
  assessments         Assessment[]         @relation("PatientAssessments")
  recordedAssessments Assessment[]         @relation("RecordedAssessments")
  progressPhotos      ProgressPhoto[]
  diaryNotes          DiaryNote[]
  uploadedMaterials   Material[]
  materialAssignments MaterialAssignment[]
  privateRecipes      Recipe[]
}

model PatientProfile {
  id           String    @id @default(cuid())
  userId       String    @unique
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  birthDate    DateTime?
  sex          Sex?
  teamNotes    String?
  dailyAiLimit Int       @default(10)
}

model Ingredient {
  id                String           @id @default(cuid())
  name              String
  source            IngredientSource
  sourceKey         String?
  kcalPer100g       Float
  proteinGPer100g   Float
  carbsGPer100g     Float
  fatGPer100g       Float
  fiberGPer100g     Float?
  householdMeasures Json?
  createdAt         DateTime         @default(now())

  recipeIngredients RecipeIngredient[]
  mealSlotItems     MealSlotItem[]

  @@unique([source, sourceKey])
  @@index([name])
}

model Recipe {
  id                 String       @id @default(cuid())
  name               String
  instructions       String
  servings           Float        @default(1)
  suitableMealTypes  MealType[]
  status             RecipeStatus @default(PRIVATE)
  origin             RecipeOrigin
  patientId          String?
  patient            User?        @relation(fields: [patientId], references: [id], onDelete: SetNull)
  // Totais POR PORÇÃO, denormalizados. Sempre recalculados pelo sistema
  // (soma dos ingredientes) a cada edição — nunca preenchidos por LLM.
  kcalPerServing     Float        @default(0)
  proteinGPerServing Float        @default(0)
  carbsGPerServing   Float        @default(0)
  fatGPerServing     Float        @default(0)
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  ingredients     RecipeIngredient[]
  mealSlotItems   MealSlotItem[]
  mealLogs        MealLog[]
  mealSuggestions MealSuggestion[]

  @@index([status])
}

model RecipeIngredient {
  recipeId     String
  recipe       Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  ingredientId String
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id])
  quantityG    Float

  @@id([recipeId, ingredientId])
}

model MealPlan {
  id            String   @id @default(cuid())
  patientId     String
  patient       User     @relation(fields: [patientId], references: [id], onDelete: Cascade)
  active        Boolean  @default(true)
  dailyKcal     Float
  dailyProteinG Float
  dailyCarbsG   Float
  dailyFatG     Float
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  slots MealSlot[]

  @@index([patientId, active])
}

model MealSlot {
  id         String   @id @default(cuid())
  mealPlanId String
  mealPlan   MealPlan @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  name       String
  order      Int
  timeHint   String?
  mealType   MealType
  kcal       Float
  proteinG   Float
  carbsG     Float
  fatG       Float

  items           MealSlotItem[]
  mealLogs        MealLog[]
  mealSuggestions MealSuggestion[]
}

model MealSlotItem {
  id           String      @id @default(cuid())
  mealSlotId   String
  mealSlot     MealSlot    @relation(fields: [mealSlotId], references: [id], onDelete: Cascade)
  // Exatamente um dos dois: ingrediente (com quantityG) OU receita (com servings)
  ingredientId String?
  ingredient   Ingredient? @relation(fields: [ingredientId], references: [id])
  recipeId     String?
  recipe       Recipe?     @relation(fields: [recipeId], references: [id])
  quantityG    Float?
  servings     Float?
}

model MealLog {
  id              String        @id @default(cuid())
  patientId       String
  patient         User          @relation(fields: [patientId], references: [id], onDelete: Cascade)
  date            DateTime      @db.Date
  mealSlotId      String
  mealSlot        MealSlot      @relation(fields: [mealSlotId], references: [id])
  status          MealLogStatus
  type            MealLogType?
  recipeId        String?
  recipe          Recipe?       @relation(fields: [recipeId], references: [id])
  portionFactor   Float?
  freeDescription String?
  // Snapshot do consumido, congelado no registro — histórico imutável.
  kcal            Float         @default(0)
  proteinG        Float         @default(0)
  carbsG          Float         @default(0)
  fatG            Float         @default(0)
  notes           String?
  loggedAt        DateTime      @default(now())

  photos MealLogPhoto[]

  @@unique([patientId, date, mealSlotId])
}

model MealLogPhoto {
  id        String  @id @default(cuid())
  mealLogId String
  mealLog   MealLog @relation(fields: [mealLogId], references: [id], onDelete: Cascade)
  r2Key     String
}

model AiJob {
  id           String      @id @default(cuid())
  type         AiJobType
  status       AiJobStatus @default(PENDING)
  patientId    String
  patient      User        @relation(fields: [patientId], references: [id], onDelete: Cascade)
  input        Json
  result       Json?
  error        String?
  inputTokens  Int?
  outputTokens Int?
  costUsd      Decimal?    @db.Decimal(10, 6)
  createdAt    DateTime    @default(now())
  completedAt  DateTime?

  mealSuggestions MealSuggestion[]

  @@index([patientId, createdAt])
}

model MealSuggestion {
  id            String   @id @default(cuid())
  patientId     String
  patient       User     @relation(fields: [patientId], references: [id], onDelete: Cascade)
  mealSlotId    String
  mealSlot      MealSlot @relation(fields: [mealSlotId], references: [id], onDelete: Cascade)
  date          DateTime @db.Date
  recipeId      String
  recipe        Recipe   @relation(fields: [recipeId], references: [id])
  portionFactor Float
  kcal          Float
  proteinG      Float
  carbsG        Float
  fatG          Float
  aiJobId       String?
  aiJob         AiJob?   @relation(fields: [aiJobId], references: [id])
  createdAt     DateTime @default(now())

  @@index([patientId, date])
}

model Assessment {
  id           String           @id @default(cuid())
  patientId    String
  patient      User             @relation("PatientAssessments", fields: [patientId], references: [id], onDelete: Cascade)
  date         DateTime         @db.Date
  source       AssessmentSource
  recordedById String?
  recordedBy   User?            @relation("RecordedAssessments", fields: [recordedById], references: [id])
  weightKg     Float?
  heightCm     Float?
  waistCm      Float?
  hipCm        Float?
  chestCm      Float?
  armCm        Float?
  thighCm      Float?
  bodyFatPct   Float?
  muscleMassKg Float?
  notes        String?

  @@index([patientId, date])
}

model ProgressPhoto {
  id        String           @id @default(cuid())
  patientId String
  patient   User             @relation(fields: [patientId], references: [id], onDelete: Cascade)
  r2Key     String
  source    AssessmentSource @default(PATIENT)
  takenAt   DateTime         @default(now())
}

model DiaryNote {
  id        String   @id @default(cuid())
  patientId String
  patient   User     @relation(fields: [patientId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  text      String

  @@unique([patientId, date])
}

model Material {
  id           String       @id @default(cuid())
  title        String
  type         MaterialType
  r2Key        String?
  url          String?
  isGlobal     Boolean      @default(false)
  uploadedById String
  uploadedBy   User         @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime     @default(now())

  assignments MaterialAssignment[]
}

model MaterialAssignment {
  id         String   @id @default(cuid())
  materialId String
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  patientId  String
  patient    User     @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@unique([materialId, patientId])
}
```

- [ ] **Step 4: Ignorar o client gerado e gerar no install**

Adicionar ao `.gitignore`:

```
# prisma client gerado
/src/generated/prisma
```

Adicionar em `"scripts"` do `package.json`: `"postinstall": "prisma generate"`.

- [ ] **Step 5: Validar o schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 6: Rodar a migração inicial**

Run: `npx prisma migrate dev --name init`
Expected: migração criada em `prisma/migrations/` e aplicada; client gerado em `src/generated/prisma`.

- [ ] **Step 7: Commit**

```bash
git add prisma prisma.config.ts .gitignore package.json package-lock.json
git commit -m "feat: schema Prisma completo do MVP + migracao inicial (Prisma 7)"
```

**Critérios de aceite (Codex):** `npx prisma validate` passa; `npx prisma migrate dev` aplica sem erro; todas as entidades e enums do design doc (seção 4) existem no schema; nenhum campo de macro em Recipe é preenchível sem cálculo (defaults 0).

---

### Task 4: Client Prisma singleton + seed do admin — [CODEX]

**Files:**
- Create: `src/server/db.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar bcryptjs**

```powershell
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Criar `src/server/db.ts`** (singleton para não esgotar conexões no dev; Prisma 7 = client gerado + driver adapter)

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

(Import relativo — não usar o alias `@/` aqui, para o arquivo funcionar igual no Next, no Vitest e nos scripts tsx.)

- [ ] **Step 3: Criar `prisma/seed.ts`** (o env vem do `tsx --env-file=.env` configurado no `prisma.config.ts`)

```ts
import { hash } from "bcryptjs";
import { prisma } from "../src/server/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env");
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      mustChangePassword: false,
    },
  });

  console.log(`Admin ${email} criado/confirmado.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Conferir o seed no `prisma.config.ts`**

O comando de seed já foi configurado na Task 3 (`migrations.seed` no `prisma.config.ts`) — no Prisma 7 ele NÃO vai no `package.json`. Só conferir que está lá.

- [ ] **Step 5: Rodar o seed e verificar**

Run: `npx prisma db seed`
Expected: `Admin <email> criado/confirmado.`
Verificar: `npx prisma studio` (ou query) mostra 1 User com role ADMIN.

- [ ] **Step 6: Commit**

```bash
git add src/server/db.ts prisma/seed.ts package.json package-lock.json
git commit -m "feat: client Prisma singleton e seed do admin"
```

**Critérios de aceite (Codex):** seed é idempotente (rodar duas vezes não duplica nem sobrescreve a senha); admin criado com `mustChangePassword: false`; senha nunca logada.

---

### Task 5: Parser TACO (TDD) — [CODEX]

Normaliza os alimentos da tabela TACO para o formato `Ingredient`. Função pura, testada. A TACO usa "Tr" (traços), "NA", "*" e vazio para valores não mensuráveis — tudo vira 0 (ou null para fibra ausente).

**Files:**
- Create: `src/server/services/taco.ts`
- Test: `src/server/services/taco.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

`src/server/services/taco.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeTacoFood, type RawTacoFood } from "./taco";

const base: RawTacoFood = {
  id: 1,
  description: "Arroz, integral, cozido",
  energy_kcal: 123.5,
  protein_g: 2.6,
  carbohydrate_g: 25.8,
  lipid_g: 1.0,
  fiber_g: 2.7,
};

describe("normalizeTacoFood", () => {
  it("converte um alimento com valores numéricos", () => {
    expect(normalizeTacoFood(base)).toEqual({
      name: "Arroz, integral, cozido",
      source: "TACO",
      sourceKey: "1",
      kcalPer100g: 123.5,
      proteinGPer100g: 2.6,
      carbsGPer100g: 25.8,
      fatGPer100g: 1.0,
      fiberGPer100g: 2.7,
    });
  });

  it("trata 'Tr', 'NA', '*' e string vazia como 0", () => {
    const food = { ...base, protein_g: "Tr", lipid_g: "NA", carbohydrate_g: "*", energy_kcal: "" };
    const result = normalizeTacoFood(food);
    expect(result?.proteinGPer100g).toBe(0);
    expect(result?.fatGPer100g).toBe(0);
    expect(result?.carbsGPer100g).toBe(0);
    expect(result?.kcalPer100g).toBe(0);
  });

  it("aceita decimal com vírgula em strings", () => {
    const result = normalizeTacoFood({ ...base, protein_g: "2,59" });
    expect(result?.proteinGPer100g).toBeCloseTo(2.59);
  });

  it("fibra ausente (null) vira null, não 0", () => {
    const result = normalizeTacoFood({ ...base, fiber_g: null });
    expect(result?.fiberGPer100g).toBeNull();
  });

  it("descarta alimento sem descrição", () => {
    expect(normalizeTacoFood({ ...base, description: "  " })).toBeNull();
  });

  it("remove espaços extras do nome", () => {
    const result = normalizeTacoFood({ ...base, description: "  Feijão, carioca  " });
    expect(result?.name).toBe("Feijão, carioca");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/server/services/taco.test.ts`
Expected: FAIL — módulo `./taco` não existe.

- [ ] **Step 3: Implementar `src/server/services/taco.ts`**

```ts
// Normalização da tabela TACO para o formato Ingredient.
// A TACO marca valores não mensuráveis com "Tr" (traços), "NA", "*" ou vazio.

export type RawTacoFood = {
  id: number | string;
  description: string;
  energy_kcal: number | string | null;
  protein_g: number | string | null;
  carbohydrate_g: number | string | null;
  lipid_g: number | string | null;
  fiber_g: number | string | null;
};

export type IngredientInput = {
  name: string;
  source: "TACO";
  sourceKey: string;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
  fiberGPer100g: number | null;
};

function toNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeTacoFood(raw: RawTacoFood): IngredientInput | null {
  const name = raw.description?.trim();
  if (!name) return null;

  return {
    name,
    source: "TACO",
    sourceKey: String(raw.id),
    kcalPer100g: toNumber(raw.energy_kcal),
    proteinGPer100g: toNumber(raw.protein_g),
    carbsGPer100g: toNumber(raw.carbohydrate_g),
    fatGPer100g: toNumber(raw.lipid_g),
    fiberGPer100g: raw.fiber_g == null ? null : toNumber(raw.fiber_g),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/server/services/taco.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/taco.ts src/server/services/taco.test.ts
git commit -m "feat: parser de alimentos da tabela TACO (TDD)"
```

**Critérios de aceite (Codex):** todos os testes passam; `normalizeTacoFood` é pura (sem I/O); nenhum valor nutricional é inventado — só conversão de formato.

---

### Task 6: Dataset TACO + script de importação — [CODEX]

**Escopo:** só a TACO na Fase 1 (~597 alimentos cobrem o essencial). A TBCA fica para quando a equipe sentir falta de alimentos — o enum `IngredientSource.TBCA` e o padrão de importação já deixam o caminho pronto.

**Files:**
- Create: `prisma/data/taco.json`
- Create: `scripts/import-taco.ts`
- Modify: `package.json` (script npm)

- [ ] **Step 1: Obter o dataset TACO em JSON**

Buscar na web/GitHub por dataset JSON da TACO (Tabela Brasileira de Composição de Alimentos — NEPA/Unicamp, ~597 alimentos). Candidatos conhecidos: repositórios `taco-api` / `taco-db-food-data` no GitHub. Salvar em `prisma/data/taco.json`.

**Importante:** inspecionar o shape do JSON baixado. Se as chaves diferirem de `RawTacoFood` (Task 5 — `id`, `description`, `energy_kcal`, `protein_g`, `carbohydrate_g`, `lipid_g`, `fiber_g`), escrever a conversão APENAS no script de importação (Step 2), mapeando para `RawTacoFood` antes de chamar `normalizeTacoFood`. Os testes da Task 5 definem o contrato canônico — não alterá-los para acomodar o dataset.

- [ ] **Step 2: Criar `scripts/import-taco.ts`**

```ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/server/db";
import { normalizeTacoFood, type RawTacoFood } from "../src/server/services/taco";

async function main() {
  const path = process.argv[2] ?? "prisma/data/taco.json";
  const rawFoods = JSON.parse(readFileSync(path, "utf-8")) as RawTacoFood[];

  let imported = 0;
  let skipped = 0;

  for (const raw of rawFoods) {
    const input = normalizeTacoFood(raw);
    if (!input) {
      skipped++;
      continue;
    }
    await prisma.ingredient.upsert({
      where: { source_sourceKey: { source: input.source, sourceKey: input.sourceKey } },
      update: {
        name: input.name,
        kcalPer100g: input.kcalPer100g,
        proteinGPer100g: input.proteinGPer100g,
        carbsGPer100g: input.carbsGPer100g,
        fatGPer100g: input.fatGPer100g,
        fiberGPer100g: input.fiberGPer100g,
      },
      create: input,
    });
    imported++;
  }

  console.log(`Importados/atualizados: ${imported}. Descartados: ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

(Se o dataset tiver shape diferente, adicionar aqui uma função `mapRawDataset(item): RawTacoFood` e aplicá-la antes de `normalizeTacoFood`.)

- [ ] **Step 3: Adicionar script npm**

Em `"scripts"` do `package.json`: `"import:taco": "tsx --env-file=.env scripts/import-taco.ts"`.

- [ ] **Step 4: Rodar a importação**

Run: `npm run import:taco`
Expected: `Importados/atualizados: ~590+. Descartados: <n>.`

- [ ] **Step 5: Verificar idempotência e dados**

Run: `npm run import:taco` (segunda vez)
Expected: mesmo total, sem duplicatas.
Verificar amostra no banco: `Arroz, integral, cozido` deve ter kcal ≈ 124/100g (sanidade contra a TACO oficial).

- [ ] **Step 6: Commit**

```bash
git add prisma/data/taco.json scripts/import-taco.ts package.json
git commit -m "feat: importacao da tabela TACO para o banco de ingredientes"
```

**Critérios de aceite (Codex):** importação idempotente (upsert por `source+sourceKey`); ~590+ ingredientes no banco; valores conferem com a TACO oficial em amostragem; dataset commitado no repo para reprodutibilidade.

---

### Task 7: Auth.js v5 — serviço de login (TDD), config e middleware — [CODEX]

**Files:**
- Create: `src/server/services/login.ts`
- Test: `src/server/services/login.test.ts`
- Create: `src/server/auth/config.ts` (edge-safe: sem Prisma/bcrypt)
- Create: `src/server/auth/index.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Instalar Auth.js v5**

```powershell
npm install next-auth@beta
```

Gerar secret (se ainda não houver no `.env`): `openssl rand -base64 32` → colocar em `AUTH_SECRET` no `.env`.

- [ ] **Step 2: Escrever os testes do serviço de login (falhando)**

`src/server/services/login.test.ts`:

```ts
import { hashSync } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { validateLoginWith, type UserRecord } from "./login";

const password = "senha-correta";
const user: UserRecord = {
  id: "u1",
  email: "ana@example.com",
  name: "Ana",
  role: "PATIENT",
  mustChangePassword: false,
  active: true,
  passwordHash: hashSync(password, 4),
};

const findUser = (record: UserRecord | null) => async (_email: string) => record;

describe("validateLoginWith", () => {
  it("retorna o usuário (sem hash) com credenciais válidas", async () => {
    const result = await validateLoginWith(findUser(user), "ana@example.com", password);
    expect(result).toEqual({
      id: "u1",
      email: "ana@example.com",
      name: "Ana",
      role: "PATIENT",
      mustChangePassword: false,
    });
  });

  it("normaliza o email (trim + lowercase) antes de buscar", async () => {
    let searched = "";
    const spy = async (email: string) => {
      searched = email;
      return user;
    };
    await validateLoginWith(spy, "  ANA@Example.com ", password);
    expect(searched).toBe("ana@example.com");
  });

  it("retorna null com senha errada", async () => {
    expect(await validateLoginWith(findUser(user), "ana@example.com", "errada")).toBeNull();
  });

  it("retorna null se o usuário não existe", async () => {
    expect(await validateLoginWith(findUser(null), "x@example.com", password)).toBeNull();
  });

  it("retorna null se o usuário está inativo", async () => {
    const inactive = { ...user, active: false };
    expect(await validateLoginWith(findUser(inactive), "ana@example.com", password)).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/server/services/login.test.ts`
Expected: FAIL — módulo `./login` não existe.

- [ ] **Step 4: Implementar `src/server/services/login.ts`**

```ts
import { compare } from "bcryptjs";
import type { AuthUser } from "@/lib/types";
import { prisma } from "@/server/db";

export type UserRecord = AuthUser & {
  passwordHash: string;
  active: boolean;
};

type FindUser = (email: string) => Promise<UserRecord | null>;

export async function validateLoginWith(
  findUser: FindUser,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await findUser(email.trim().toLowerCase());
  if (!user || !user.active) return null;

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) return null;

  const { passwordHash: _hash, active: _active, ...authUser } = user;
  return authUser;
}

export function validateLogin(email: string, password: string): Promise<AuthUser | null> {
  return validateLoginWith(
    (normalizedEmail) =>
      prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          mustChangePassword: true,
          active: true,
          passwordHash: true,
        },
      }),
    email,
    password,
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/server/services/login.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Criar `src/server/auth/config.ts`** (edge-safe — importado pelo middleware; NÃO importar Prisma/bcrypt aqui)

```ts
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      if (token.role) session.user.role = token.role;
      if (typeof token.mustChangePassword === "boolean") {
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      if (pathname.startsWith("/admin")) return user?.role === "ADMIN";
      if (pathname.startsWith("/app")) return user?.role === "PATIENT";
      return true; // /login, /change-password e / cuidam de si mesmas
    },
  },
  providers: [], // preenchido em index.ts (provider usa bcrypt, não é edge-safe)
} satisfies NextAuthConfig;
```

- [ ] **Step 7: Criar `src/server/auth/index.ts`**

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validation/auth";
import { validateLogin } from "@/server/services/login";
import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return validateLogin(parsed.data.email, parsed.data.password);
      },
    }),
  ],
});
```

- [ ] **Step 8: Criar `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 9: Criar `src/middleware.ts`**

```ts
import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 10: Verificar build e testes**

Run: `npm run test` → Expected: todos os testes passam (taco + login).
Run: `npm run build` → Expected: build sem erros (confirma que o middleware não puxou Prisma/bcrypt para o bundle edge).

- [ ] **Step 11: Commit**

```bash
git add src/server/services/login.ts src/server/services/login.test.ts src/server/auth src/app/api/auth src/middleware.ts package.json package-lock.json
git commit -m "feat: autenticacao com Auth.js v5, roles e middleware de protecao"
```

**Critérios de aceite (Codex):** testes do serviço passam; `npm run build` passa; `config.ts` não importa nada com dependência de Node runtime; acesso a `/admin` sem sessão redireciona para `/login`; sessão JWT carrega `id`, `role`, `mustChangePassword`.

---

### Task 8: Serviço de troca de senha (TDD) + server actions de auth — [CODEX]

**Files:**
- Create: `src/server/services/change-password.ts`
- Test: `src/server/services/change-password.test.ts`
- Create: `src/app/(auth)/actions.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

`src/server/services/change-password.test.ts`:

```ts
import { compareSync, hashSync } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { changePasswordWith, type ChangePasswordDeps } from "./change-password";

const currentPassword = "senha-atual";

function makeDeps(overrides?: Partial<ChangePasswordDeps>) {
  const updates: { id: string; hash: string }[] = [];
  const deps: ChangePasswordDeps = {
    findUser: async () => ({ passwordHash: hashSync(currentPassword, 4) }),
    updatePassword: async (id, hash) => {
      updates.push({ id, hash });
    },
    ...overrides,
  };
  return { deps, updates };
}

describe("changePasswordWith", () => {
  it("troca a senha quando a atual confere", async () => {
    const { deps, updates } = makeDeps();
    const result = await changePasswordWith(deps, "u1", currentPassword, "nova-senha-123");
    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("u1");
    expect(compareSync("nova-senha-123", updates[0].hash)).toBe(true);
  });

  it("recusa quando a senha atual está errada", async () => {
    const { deps, updates } = makeDeps();
    const result = await changePasswordWith(deps, "u1", "errada", "nova-senha-123");
    expect(result).toEqual({ ok: false, error: "Senha atual incorreta" });
    expect(updates).toHaveLength(0);
  });

  it("recusa quando o usuário não existe", async () => {
    const { deps } = makeDeps({ findUser: async () => null });
    const result = await changePasswordWith(deps, "u1", currentPassword, "nova-senha-123");
    expect(result).toEqual({ ok: false, error: "Usuário não encontrado" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/server/services/change-password.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/server/services/change-password.ts`**

```ts
import { compare, hash } from "bcryptjs";
import { prisma } from "@/server/db";

export type ChangePasswordDeps = {
  findUser: (id: string) => Promise<{ passwordHash: string } | null>;
  updatePassword: (id: string, passwordHash: string) => Promise<void>;
};

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changePasswordWith(
  deps: ChangePasswordDeps,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await deps.findUser(userId);
  if (!user) return { ok: false, error: "Usuário não encontrado" };

  const currentOk = await compare(currentPassword, user.passwordHash);
  if (!currentOk) return { ok: false, error: "Senha atual incorreta" };

  const newHash = await hash(newPassword, 12);
  await deps.updatePassword(userId, newHash);
  return { ok: true };
}

export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  return changePasswordWith(
    {
      findUser: (id) =>
        prisma.user.findUnique({ where: { id }, select: { passwordHash: true } }),
      updatePassword: async (id, passwordHash) => {
        await prisma.user.update({
          where: { id },
          data: { passwordHash, mustChangePassword: false },
        });
      },
    },
    userId,
    currentPassword,
    newPassword,
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/server/services/change-password.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Criar `src/app/(auth)/actions.ts`** (server actions consumidas pelas telas da Task 9)

```ts
"use server";

import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/server/auth";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/server/services/change-password";

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha inválidos" };
    }
    throw error; // NEXT_REDIRECT precisa propagar
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await changePassword(
    session.user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) return { error: result.error };

  // JWT ainda carrega mustChangePassword=true; sair força novo login com token atualizado.
  await signOut({ redirectTo: "/login?changed=1" });
  return undefined;
}
```

- [ ] **Step 6: Rodar todos os testes**

Run: `npm run test`
Expected: todos passam (taco + login + change-password).

- [ ] **Step 7: Commit**

```bash
git add src/server/services/change-password.ts src/server/services/change-password.test.ts "src/app/(auth)/actions.ts"
git commit -m "feat: troca de senha (TDD) e server actions de auth"
```

**Critérios de aceite (Codex):** testes passam; troca de senha limpa `mustChangePassword`; após trocar, o usuário é deslogado (JWT antigo não fica válido com flag antiga); nenhuma senha/hash aparece em logs ou mensagens de erro.

---

### Task 9: Telas de login e troca de senha — [CLAUDE]

Depende das Tasks 7–8 (actions e auth prontos). UI mobile-first, simples e limpa.

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/login-form.tsx`
- Create: `src/app/(auth)/change-password/page.tsx`
- Create: `src/app/(auth)/change-password/change-password-form.tsx`
- Modify: `src/app/page.tsx` (roteamento por role)
- Delete: conteúdo default do scaffold em `src/app/page.tsx`

- [ ] **Step 1: Substituir `src/app/page.tsx`** (rota `/` só roteia por sessão/role)

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  redirect(session.user.role === "ADMIN" ? "/admin" : "/app");
}
```

- [ ] **Step 2: Criar `src/app/(auth)/login/login-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "../actions";

export function LoginForm({ passwordChanged }: { passwordChanged: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {passwordChanged && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Senha alterada com sucesso. Entre novamente.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Senha
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Criar `src/app/(auth)/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { changed } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-900">
          Entrar
        </h1>
        <LoginForm passwordChanged={changed === "1"} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Criar `src/app/(auth)/change-password/change-password-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "../actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    undefined,
  );

  const inputClass =
    "rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Senha atual
        <input type="password" name="currentPassword" required autoComplete="current-password" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Nova senha
        <input type="password" name="newPassword" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        Confirmar nova senha
        <input type="password" name="confirmPassword" required autoComplete="new-password" className={inputClass} />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Alterar senha"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Criar `src/app/(auth)/change-password/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          Alterar senha
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          {session.user.mustChangePassword
            ? "Por segurança, defina uma nova senha antes de continuar."
            : "Defina sua nova senha."}
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev`
- `/login` renderiza; login com credenciais do admin do seed funciona e cai em `/admin` (404 por enquanto — Task 10).
- Login com senha errada mostra "Email ou senha inválidos".
- `/change-password` logado renderiza; trocar a senha desloga e mostra a mensagem de sucesso no login; a senha nova funciona.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)" src/app/page.tsx
git commit -m "feat: telas de login e troca de senha"
```

---

### Task 10: Shells `/admin` e `/app` + verificação final — [CLAUDE]

Depende da Task 9. Layouts mínimos com navegação e logout; conteúdo real vem nas Fases 2–3.

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/app/layout.tsx`
- Create: `src/app/app/page.tsx`

- [ ] **Step 1: Criar `src/app/admin/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { logoutAction } from "../(auth)/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <span className="font-semibold text-zinc-900">Painel da equipe</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{session.user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-zinc-500 underline hover:text-zinc-900">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/app/admin/page.tsx`**

```tsx
export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Visão geral</h1>
      <p className="mt-2 text-zinc-500">
        Gestão de pacientes, planos e receitas chega na Fase 2.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Criar `src/app/app/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { logoutAction } from "../(auth)/actions";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PATIENT") redirect("/");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <span className="font-semibold text-emerald-800">Meu plano</span>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-zinc-500 underline hover:text-zinc-900">
            Sair
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Criar `src/app/app/page.tsx`**

```tsx
export default function PatientHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">Hoje</h1>
      <p className="mt-2 text-zinc-500">
        Suas refeições e seu saldo do dia aparecem aqui na Fase 3.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Verificação final da fase (ponta a ponta)**

Run: `npm run test` → Expected: todos os testes passam.
Run: `npm run build` → Expected: build sem erros.
Run: `npm run dev` e verificar manualmente:
1. Sem sessão, `/admin` e `/app` redirecionam para `/login`.
2. Login como admin do seed → cai em `/admin`, vê "Painel da equipe", logout funciona.
3. Criar um paciente de teste direto no banco (`npx prisma studio`: User com role PATIENT, `mustChangePassword: true`, hash gerado com o mesmo bcrypt) → login → é forçado a `/change-password` → troca → relogin → cai em `/app`.
4. Paciente logado acessando `/admin` é redirecionado.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin src/app/app
git commit -m "feat: shells admin e paciente com protecao por role"
```

---

## Ordem de execução e paralelismo

```
Task 1 (CLAUDE) → Task 2 (CLAUDE) → Task 3 (CODEX) → Task 4 (CODEX) ─┬→ Task 5 (CODEX) → Task 6 (CODEX)
                                                                      └→ Task 7 (CODEX) → Task 8 (CODEX) → Task 9 (CLAUDE) → Task 10 (CLAUDE)
```

- Tasks 5–6 (TACO) e 7–8 (auth) são independentes entre si e podem rodar em paralelo após a Task 4.
- Tasks 9–10 (frontend) só começam quando 7–8 estiverem commitadas.

## Definition of Done da Fase 1

- [ ] `npm run test` e `npm run build` passam.
- [ ] Admin do seed loga e vê o painel; paciente de teste loga, troca a senha obrigatória e vê o app.
- [ ] Middleware bloqueia acesso cruzado de roles.
- [ ] ~590+ ingredientes TACO no banco, importação idempotente.
- [ ] Nenhum segredo commitado.
