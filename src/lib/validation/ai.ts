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
