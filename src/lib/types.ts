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

export type DayBalance = {
  targets: MacroTotals;
  consumed: MacroTotals;
  remaining: MacroTotals; // pode ser negativo (estourou)
};

export const MEAL_LOG_TYPES = ["PLAN", "FREE_ENTRY"] as const;
export type MealLogTypePhase3 = (typeof MEAL_LOG_TYPES)[number];

export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

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
