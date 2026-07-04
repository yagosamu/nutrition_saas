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
