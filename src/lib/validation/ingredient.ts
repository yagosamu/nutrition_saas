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
