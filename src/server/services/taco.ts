// Normalização da tabela TACO para o formato Ingredient.
// A TACO marca valores não mensuráveis com "Tr" (traços), "NA", "*" ou vazio.

export type RawTacoFood = {
  id: number | string;
  description: string;
  energy_kcal: number | string | null;
  protein_g: number | string | null;
  carbohydrate_g: number | string | null;
  lipid_g: number | string | null;
  fiber_g: number | string | null;
};

export type IngredientInput = {
  name: string;
  source: "TACO";
  sourceKey: string;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
  fiberGPer100g: number | null;
};

function toNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeTacoFood(raw: RawTacoFood): IngredientInput | null {
  const name = raw.description?.trim();
  if (!name) return null;

  return {
    name,
    source: "TACO",
    sourceKey: String(raw.id),
    kcalPer100g: toNumber(raw.energy_kcal),
    proteinGPer100g: toNumber(raw.protein_g),
    carbsGPer100g: toNumber(raw.carbohydrate_g),
    fatGPer100g: toNumber(raw.lipid_g),
    fiberGPer100g: raw.fiber_g == null ? null : toNumber(raw.fiber_g),
  };
}
