import { z } from "zod";
import { utcDateFromDateString } from "@/lib/dates";
import type { AiJob } from "../../../generated/prisma/client";
import { prisma } from "@/server/db";
import { AI_MODELS, GENERATION_MAX_ATTEMPTS } from "../config";
import { runStructured, type AiUsage } from "../anthropic";
import { markJobCompleted } from "@/server/services/ai-jobs";
import { validateGeneratedRecipe } from "@/server/services/generated-recipe";

const GENERATION_SYSTEM = `Você cria receitas brasileiras práticas para uma consultoria de nutrição.
Regras invioláveis:
- Use APENAS ingredientes do catálogo fornecido, referenciando pelo id exato.
- Especifique quantidades em gramas. Rendimento: exatamente 1 porção.
- NUNCA escreva valores nutricionais — o sistema calcula tudo.
- Receita realista: 3 a 8 ingredientes, modo de preparo claro em português, nome apetitoso.
- Aproxime as metas de kcal/macros da refeição usando as quantidades.`;

const generationSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  ingredients: z.array(z.object({ ingredientId: z.string(), quantityG: z.number() })).min(3).max(8),
});
type GeneratedRecipeOutput = z.infer<typeof generationSchema>;

const inputSchema = z.object({
  mealSlotId: z.string(),
  date: z.string(),
});

export async function runGenerateJob(job: AiJob): Promise<void> {
  const input = inputSchema.parse(job.input);
  const date = utcDateFromDateString(input.date);

  const slot = await prisma.mealSlot.findFirst({
    where: { id: input.mealSlotId, mealPlan: { patientId: job.patientId, active: true } },
  });
  if (!slot) throw new Error("Slot não pertence ao plano ativo do paciente");

  const targets = { kcal: slot.kcal, proteinG: slot.proteinG, carbsG: slot.carbsG, fatG: slot.fatG };
  const [catalog, logsToday] = await Promise.all([
    prisma.ingredient.findMany({
      select: {
        id: true,
        name: true,
        kcalPer100g: true,
        proteinGPer100g: true,
        carbsGPer100g: true,
        fatGPer100g: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.mealLog.findMany({
      where: { patientId: job.patientId, date },
      select: { freeDescription: true, recipe: { select: { name: true } } },
    }),
  ]);

  const catalogById = new Map(catalog.map((i) => [i.id, i]));
  const usages: AiUsage[] = [];
  let feedback: string | null = null;
  let accepted:
    | {
        data: GeneratedRecipeOutput;
        totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
      }
    | null = null;

  for (let attempt = 1; attempt <= GENERATION_MAX_ATTEMPTS; attempt++) {
    const response: { data: GeneratedRecipeOutput; usage: AiUsage } = await runStructured({
      model: AI_MODELS.generation,
      system: [
        { text: GENERATION_SYSTEM, cache: true },
        {
          text:
            "Catálogo de ingredientes (por 100 g):\n" +
            JSON.stringify(
              catalog.map((i) => ({
                id: i.id,
                nome: i.name,
                kcalPor100g: i.kcalPer100g,
                proteinaPor100g: i.proteinGPer100g,
                carboPor100g: i.carbsGPer100g,
                gorduraPor100g: i.fatGPer100g,
              })),
            ),
          cache: true,
        },
      ],
      userContent: JSON.stringify({
        tentativa: attempt,
        refeicao: { nome: slot.name, tipo: slot.mealType },
        metas: targets,
        pacienteJaComeuHoje: logsToday.map((l) => l.recipe?.name ?? l.freeDescription).filter(Boolean),
        feedbackAnterior: feedback,
      }),
      schema: generationSchema,
    });
    const { data, usage } = response;
    usages.push(usage);

    const unknownId = data.ingredients.find((i) => !catalogById.has(i.ingredientId))?.ingredientId;
    if (unknownId) {
      feedback = `O ingrediente id ${unknownId} não existe no catálogo. Use apenas ids fornecidos.`;
      continue;
    }

    const items = data.ingredients.map((item) => ({
      ingredient: catalogById.get(item.ingredientId)!,
      quantityG: item.quantityG,
    }));
    const validation = validateGeneratedRecipe(targets, items);
    if (validation.ok) {
      accepted = { data, totals: validation.totals };
      break;
    }
    feedback = validation.feedback;
  }

  if (!accepted) {
    throw new Error("Não consegui gerar uma receita dentro das suas metas — tente de novo");
  }

  const result = await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        name: accepted.data.name,
        instructions: accepted.data.instructions,
        servings: 1,
        suitableMealTypes: [slot.mealType],
        status: "PENDING_REVIEW",
        origin: "AI_GENERATED",
        patientId: job.patientId,
        kcalPerServing: accepted.totals.kcal,
        proteinGPerServing: accepted.totals.proteinG,
        carbsGPerServing: accepted.totals.carbsG,
        fatGPerServing: accepted.totals.fatG,
        ingredients: {
          create: accepted.data.ingredients.map((item) => ({
            ingredientId: item.ingredientId,
            quantityG: item.quantityG,
          })),
        },
      },
      select: { id: true },
    });

    await tx.mealSuggestion.deleteMany({ where: { patientId: job.patientId, mealSlotId: slot.id, date } });
    const suggestion = await tx.mealSuggestion.create({
      data: {
        patientId: job.patientId,
        mealSlotId: slot.id,
        date,
        recipeId: recipe.id,
        portionFactor: 1,
        kcal: accepted.totals.kcal,
        proteinG: accepted.totals.proteinG,
        carbsG: accepted.totals.carbsG,
        fatG: accepted.totals.fatG,
        aiJobId: job.id,
      },
      select: { id: true },
    });

    return { recipeId: recipe.id, suggestionId: suggestion.id };
  });

  await markJobCompleted(job.id, result, usages);
}
