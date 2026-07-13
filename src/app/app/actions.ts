"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { registerExternalSchema, registerSuggestionSchema } from "@/lib/validation/ai";
import {
  diaryNoteSchema,
  registerFreeMealSchema,
  registerPlanMealSchema,
  skipMealSchema,
} from "@/lib/validation/meal-log";
import { patientWeightSchema } from "@/lib/validation/assessment";
import { requirePatient } from "@/server/auth/guards";
import { upsertPatientWeight } from "@/server/services/assessments";
import {
  productionMealLogDeps,
  productionExternalLookupDeps,
  productionSuggestionLookupDeps,
  registerExternalMealWith,
  registerFreeMealWith,
  registerPlanMealWith,
  registerSuggestionMealWith,
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

export async function registerSuggestionMealAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = registerSuggestionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await registerSuggestionMealWith(
    productionMealLogDeps(),
    productionSuggestionLookupDeps(),
    patient.id,
    parsed.data,
  );
  if (result.ok) revalidateApp();
  return result;
}

export async function registerExternalMealAction(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = registerExternalSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await registerExternalMealWith(
    productionMealLogDeps(),
    productionExternalLookupDeps(),
    patient.id,
    parsed.data,
  );
  if (result.ok) revalidateApp();
  return result;
}

export async function registerWeightAction(payload: unknown): Promise<ActionResult> {
  const patient = await requirePatient();
  if (!patient) return { ok: false, error: "Sem permissão" };
  const parsed = patientWeightSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const result = await upsertPatientWeight(patient.id, parsed.data.weightKg);
  if (result.ok) revalidatePath("/app/progress");
  return result;
}
