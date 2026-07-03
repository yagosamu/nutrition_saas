import { describe, expect, it } from "vitest";
import { normalizeTacoFood, type RawTacoFood } from "./taco";

const base: RawTacoFood = {
  id: 1,
  description: "Arroz, integral, cozido",
  energy_kcal: 123.5,
  protein_g: 2.6,
  carbohydrate_g: 25.8,
  lipid_g: 1.0,
  fiber_g: 2.7,
};

describe("normalizeTacoFood", () => {
  it("converte um alimento com valores numéricos", () => {
    expect(normalizeTacoFood(base)).toEqual({
      name: "Arroz, integral, cozido",
      source: "TACO",
      sourceKey: "1",
      kcalPer100g: 123.5,
      proteinGPer100g: 2.6,
      carbsGPer100g: 25.8,
      fatGPer100g: 1.0,
      fiberGPer100g: 2.7,
    });
  });

  it("trata 'Tr', 'NA', '*' e string vazia como 0", () => {
    const food = { ...base, protein_g: "Tr", lipid_g: "NA", carbohydrate_g: "*", energy_kcal: "" };
    const result = normalizeTacoFood(food);
    expect(result?.proteinGPer100g).toBe(0);
    expect(result?.fatGPer100g).toBe(0);
    expect(result?.carbsGPer100g).toBe(0);
    expect(result?.kcalPer100g).toBe(0);
  });

  it("aceita decimal com vírgula em strings", () => {
    const result = normalizeTacoFood({ ...base, protein_g: "2,59" });
    expect(result?.proteinGPer100g).toBeCloseTo(2.59);
  });

  it("fibra ausente (null) vira null, não 0", () => {
    const result = normalizeTacoFood({ ...base, fiber_g: null });
    expect(result?.fiberGPer100g).toBeNull();
  });

  it("descarta alimento sem descrição", () => {
    expect(normalizeTacoFood({ ...base, description: "  " })).toBeNull();
  });

  it("remove espaços extras do nome", () => {
    const result = normalizeTacoFood({ ...base, description: "  Feijão, carioca  " });
    expect(result?.name).toBe("Feijão, carioca");
  });
});
