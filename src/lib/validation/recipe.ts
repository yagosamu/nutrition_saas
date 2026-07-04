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
