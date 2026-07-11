import { z } from "zod";
import { utcDateFromDateString } from "@/lib/dates";
import type { AiJob } from "../../../generated/prisma/client";
import { prisma } from "@/server/db";
import { AI_MODELS } from "../config";
import { runStructured, type AiUsage } from "../anthropic";
import { markJobCompleted } from "@/server/services/ai-jobs";
import { selectCandidates } from "@/server/services/suggestion-candidates";

const RANKING_SYSTEM = `Você é a assistente de nutrição de uma consultoria brasileira.
Sua única tarefa: escolher, entre as receitas candidatas fornecidas, as 3 melhores opções para a refeição do paciente, priorizando:
1. Variedade em relação ao que o paciente já comeu hoje e às sugestões recentes.
2. Adequação cultural e praticidade para o tipo de refeição.
Regras invioláveis:
- Escolha APENAS ids presentes na lista de candidatas (todas já couberam nas metas — não avalie números).
- NUNCA invente valores nutricionais nem comente números.
- Se houver menos de 3 candidatas, selecione todas.`;

const rankingSchema = z.object({
  selections: z.array(z.object({ recipeId: z.string() })).max(3),
});

const inputSchema = z.object({
  mealSlotId: z.string(),
  date: z.string(),
  force: z.boolean().optional(),
});

export async function runSuggestJob(job: AiJob): Promise<void> {
  const input = inputSchema.parse(job.input);
  const date = utcDateFromDateString(input.date);

  const slot = await prisma.mealSlot.findFirst({
    where: { id: input.mealSlotId, mealPlan: { patientId: job.patientId, active: true } },
  });
  if (!slot) throw new Error("Slot não pertence ao plano ativo do paciente");

  const targets = { kcal: slot.kcal, proteinG: slot.proteinG, carbsG: slot.carbsG, fatG: slot.fatG };

  // 1. Pré-filtro SQL: aprovadas, do tipo certo, com kcal
  const recipes = await prisma.recipe.findMany({
    where: { status: "APPROVED", suitableMealTypes: { has: slot.mealType }, kcalPerServing: { gt: 0 } },
    select: {
      id: true,
      name: true,
      kcalPerServing: true,
      proteinGPerServing: true,
      carbsGPerServing: true,
      fatGPerServing: true,
    },
  });

  // 2. Escala determinística — o sistema decide o que cabe
  const candidates = selectCandidates(targets, recipes);
  if (candidates.length === 0) {
    await markJobCompleted(job.id, { suggestionCount: 0 }, []);
    return;
  }

  // 3. Contexto do dia (variedade)
  const [logsToday, recentSuggestions] = await Promise.all([
    prisma.mealLog.findMany({
      where: { patientId: job.patientId, date },
      select: { freeDescription: true, recipe: { select: { name: true } } },
    }),
    prisma.mealSuggestion.findMany({
      where: { patientId: job.patientId, date: { gte: new Date(date.getTime() - 3 * 86_400_000) } },
      select: { recipe: { select: { name: true } } },
      take: 20,
    }),
  ]);

  const usages: AiUsage[] = [];
  let selectedIds: string[];

  if (candidates.length <= 3) {
    selectedIds = candidates.map((c) => c.recipe.id);
  } else {
    // 4. Claude só ranqueia — nunca calcula
    const { data, usage } = await runStructured({
      model: AI_MODELS.ranking,
      system: [{ text: RANKING_SYSTEM, cache: true }],
      userContent: JSON.stringify({
        tipoRefeicao: slot.mealType,
        nomeRefeicao: slot.name,
        candidatas: candidates.map((c) => ({ id: c.recipe.id, nome: c.recipe.name })),
        pacienteJaComeuHoje: logsToday.map((l) => l.recipe?.name ?? l.freeDescription).filter(Boolean),
        sugestoesRecentes: recentSuggestions.map((s) => s.recipe.name),
      }),
      schema: rankingSchema,
    });
    usages.push(usage);
    const valid = new Set(candidates.map((c) => c.recipe.id));
    selectedIds = data.selections.map((s) => s.recipeId).filter((id) => valid.has(id));
    if (selectedIds.length === 0) selectedIds = candidates.slice(0, 3).map((c) => c.recipe.id);
  }

  // 5. Persistir substituindo as sugestões do slot+dia (snapshot calculado pelo sistema)
  const byId = new Map(candidates.map((c) => [c.recipe.id, c]));
  const rows = selectedIds.slice(0, 3).map((id) => {
    const c = byId.get(id)!;
    return {
      patientId: job.patientId,
      mealSlotId: slot.id,
      date,
      recipeId: id,
      portionFactor: c.fit.factor,
      kcal: c.fit.macros.kcal,
      proteinG: c.fit.macros.proteinG,
      carbsG: c.fit.macros.carbsG,
      fatG: c.fit.macros.fatG,
      aiJobId: job.id,
    };
  });

  await prisma.$transaction([
    prisma.mealSuggestion.deleteMany({ where: { patientId: job.patientId, mealSlotId: slot.id, date } }),
    prisma.mealSuggestion.createMany({ data: rows }),
  ]);

  await markJobCompleted(job.id, { suggestionCount: rows.length }, usages);
}
