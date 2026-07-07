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
