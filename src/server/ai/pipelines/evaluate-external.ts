import { z } from "zod";
import { computeExternalVerdict, computeRecipeTotals } from "@/lib/nutrition";
import { utcDateFromDateString } from "@/lib/dates";
import type { AiJob } from "../../../generated/prisma/client";
import { prisma } from "@/server/db";
import { AI_MODELS } from "../config";
import { runStructured, type AiUsage } from "../anthropic";
import { markJobCompleted } from "@/server/services/ai-jobs";
import { fetchRecipePage } from "@/server/services/external-text";

const EXTRACTION_SYSTEM = `Você extrai ingredientes de receitas em português.
Do texto fornecido, extraia: nome da receita, rendimento em porções (estime se ausente; mínimo 1)
e a lista de ingredientes com quantidade em GRAMAS (converta xícaras/colheres/unidades usando
equivalências brasileiras comuns; estime com bom senso quando impreciso).
NUNCA escreva valores nutricionais (kcal/macros) — apenas nomes e gramas.`;

const extractionSchema = z.object({
  recipeName: z.string(),
  servings: z.number().min(1),
  ingredients: z.array(z.object({ name: z.string(), quantityG: z.number() })).min(1).max(30),
});

const MAPPING_SYSTEM = `Você mapeia nomes de ingredientes para um catálogo de tabela nutricional brasileira (TACO).
Para cada ingrediente extraído, escolha o candidato do catálogo que melhor corresponde ao alimento
COMO ELE É USADO na receita (cru/cozido/grelhado importa). Se nenhum candidato for uma correspondência
razoável, responda null para aquele item. NUNCA escolha por aproximação forçada.`;

const mappingSchema = z.object({
  mappings: z.array(z.object({ extractedName: z.string(), ingredientId: z.string().nullable() })),
});

const inputSchema = z.object({
  mealSlotId: z.string(),
  date: z.string(),
  text: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

function wordsForSearch(name: string): string[] {
  return Array.from(
    new Set(
      name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((w) => w.length >= 3),
    ),
  ).slice(0, 4);
}

export async function runEvaluateJob(job: AiJob): Promise<void> {
  const input = inputSchema.parse(job.input);
  const date = utcDateFromDateString(input.date);
  const slot = await prisma.mealSlot.findFirst({
    where: { id: input.mealSlotId, mealPlan: { patientId: job.patientId, active: true } },
  });
  if (!slot) throw new Error("Slot não pertence ao plano ativo do paciente");
  const targets = { kcal: slot.kcal, proteinG: slot.proteinG, carbsG: slot.carbsG, fatG: slot.fatG };

  const recipeText = input.text?.trim() || (input.url ? await fetchRecipePage(input.url) : "");
  if (!recipeText) throw new Error("Envie o texto da receita ou um link");

  const usages: AiUsage[] = [];
  const { data: extracted, usage: extractionUsage } = await runStructured({
    model: AI_MODELS.extraction,
    system: [{ text: EXTRACTION_SYSTEM, cache: true }],
    userContent: recipeText,
    schema: extractionSchema,
  });
  usages.push(extractionUsage);

  const candidateEntries = await Promise.all(
    extracted.ingredients.map(async (ingredient) => {
      const words = wordsForSearch(ingredient.name);
      const candidates =
        words.length === 0
          ? []
          : await prisma.ingredient.findMany({
              where: { OR: words.map((word) => ({ name: { contains: word, mode: "insensitive" } })) },
              take: 6,
              select: { id: true, name: true },
            });
      return { ingredient, candidates };
    }),
  );

  const { data: mapped, usage: mappingUsage } = await runStructured({
    model: AI_MODELS.extraction,
    system: [{ text: MAPPING_SYSTEM, cache: true }],
    userContent: JSON.stringify({
      extraidos: candidateEntries.map((entry) => ({
        name: entry.ingredient.name,
        candidatos: entry.candidates.map((c) => ({ id: c.id, nome: c.name })),
      })),
    }),
    schema: mappingSchema,
  });
  usages.push(mappingUsage);

  const candidateIdsByName = new Map(
    candidateEntries.map((entry) => [entry.ingredient.name, new Set(entry.candidates.map((c) => c.id))]),
  );
  const extractedByName = new Map(candidateEntries.map((entry) => [entry.ingredient.name, entry.ingredient]));
  const validMappings = mapped.mappings
    .map((mapping) => {
      if (!mapping.ingredientId) return null;
      const allowed = candidateIdsByName.get(mapping.extractedName);
      const extractedIngredient = extractedByName.get(mapping.extractedName);
      if (!allowed?.has(mapping.ingredientId) || !extractedIngredient) return null;
      return { extracted: extractedIngredient, ingredientId: mapping.ingredientId };
    })
    .filter((m): m is { extracted: { name: string; quantityG: number }; ingredientId: string } => m != null);

  if (validMappings.length === 0) {
    throw new Error("Não reconheci os ingredientes dessa receita — confira o texto");
  }

  const ingredientRows = await prisma.ingredient.findMany({
    where: { id: { in: validMappings.map((m) => m.ingredientId) } },
    select: {
      id: true,
      name: true,
      kcalPer100g: true,
      proteinGPer100g: true,
      carbsGPer100g: true,
      fatGPer100g: true,
    },
  });
  const ingredientById = new Map(ingredientRows.map((i) => [i.id, i]));
  const mappedIngredients = validMappings
    .map((mapping) => {
      const ingredient = ingredientById.get(mapping.ingredientId);
      if (!ingredient) return null;
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantityG: mapping.extracted.quantityG,
        ingredient,
      };
    })
    .filter(
      (
        item,
      ): item is {
        ingredientId: string;
        name: string;
        quantityG: number;
        ingredient: (typeof ingredientRows)[number];
      } => item != null,
    );

  if (mappedIngredients.length === 0) {
    throw new Error("Não reconheci os ingredientes dessa receita — confira o texto");
  }

  const mappedNames = new Set(validMappings.map((m) => m.extracted.name));
  const unmappedIngredients = extracted.ingredients
    .filter((ingredient) => !mappedNames.has(ingredient.name))
    .map((ingredient) => ingredient.name);

  const perServing = computeRecipeTotals(
    mappedIngredients.map((item) => ({ quantityG: item.quantityG, ingredient: item.ingredient })),
    extracted.servings,
  );
  const verdict = computeExternalVerdict(targets, perServing);

  await markJobCompleted(
    job.id,
    {
      verdict: verdict.verdict,
      factor: verdict.factor,
      macros: verdict.macros,
      reason: verdict.reason,
      recipeName: extracted.recipeName,
      servings: extracted.servings,
      mappedIngredients: mappedIngredients.map((item) => ({
        ingredientId: item.ingredientId,
        name: item.name,
        quantityG: item.quantityG,
      })),
      unmappedIngredients,
      mealSlotId: slot.id,
      date: input.date,
    },
    usages,
  );
}
