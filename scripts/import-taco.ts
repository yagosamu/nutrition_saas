import { readFileSync } from "node:fs";
import { prisma } from "../src/server/db";
import { normalizeTacoFood, type RawTacoFood } from "../src/server/services/taco";

type RawDatasetItem = {
  "Numero do Alimento": string;
  "Descrição dos Alimentos": string;
  "Energia (kcal)": string;
  "Proteína (g)": string;
  "Carboidrato (g)": string;
  "Lipídeos (g)": string;
  "Fibra Alimentar (g)": string;
};

function mapRawDataset(item: RawDatasetItem): RawTacoFood {
  return {
    id: item["Numero do Alimento"],
    description: item["Descrição dos Alimentos"],
    energy_kcal: item["Energia (kcal)"],
    protein_g: item["Proteína (g)"],
    carbohydrate_g: item["Carboidrato (g)"],
    lipid_g: item["Lipídeos (g)"],
    fiber_g: item["Fibra Alimentar (g)"] || null,
  };
}

async function main() {
  const path = process.argv[2] ?? "prisma/data/taco.json";
  const dataset = JSON.parse(readFileSync(path, "utf-8")) as RawDatasetItem[];
  const rawFoods = dataset.map(mapRawDataset);

  let imported = 0;
  let skipped = 0;

  for (const raw of rawFoods) {
    const input = normalizeTacoFood(raw);
    if (!input) {
      skipped++;
      continue;
    }
    await prisma.ingredient.upsert({
      where: { source_sourceKey: { source: input.source, sourceKey: input.sourceKey } },
      update: {
        name: input.name,
        kcalPer100g: input.kcalPer100g,
        proteinGPer100g: input.proteinGPer100g,
        carbsGPer100g: input.carbsGPer100g,
        fatGPer100g: input.fatGPer100g,
        fiberGPer100g: input.fiberGPer100g,
      },
      create: input,
    });
    imported++;
  }

  console.log(`Importados/atualizados: ${imported}. Descartados: ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
