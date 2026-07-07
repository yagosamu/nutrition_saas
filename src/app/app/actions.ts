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
