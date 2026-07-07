import { describe, expect, it } from "vitest";
import { computeRecipeTotals, scalePer100, scaleServing, sumMacros, round1 } from "./nutrition";
import type { MacroTotals } from "./types";

const arroz = { kcalPer100g: 124, proteinGPer100g: 2.6, carbsGPer100g: 25.8, fatGPer100g: 1 };
const frango = { kcalPer100g: 159, proteinGPer100g: 32, carbsGPer100g: 0, fatGPer100g: 2.5 };

describe("round1", () => {
  it("arredonda para 1 casa decimal", () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(1.24)).toBe(1.2);
  });
});

describe("scalePer100", () => {
  it("100 g devolve os macros de tabela", () => {
    expect(scalePer100(arroz, 100)).toEqual({ kcal: 124, proteinG: 2.6, carbsG: 25.8, fatG: 1 });
  });
  it("escala linearmente por gramas", () => {
    expect(scalePer100(arroz, 50)).toEqual({ kcal: 62, proteinG: 1.3, carbsG: 12.9, fatG: 0.5 });
  });
});

describe("scaleServing", () => {
  it("multiplica macros por porções", () => {
    const perServing: MacroTotals = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 };
    expect(scaleServing(perServing, 1.5)).toEqual({ kcal: 300, proteinG: 15, carbsG: 30, fatG: 7.5 });
  });
});

describe("sumMacros", () => {
  it("soma uma lista de macros", () => {
    const a: MacroTotals = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 };
    const b: MacroTotals = { kcal: 50, proteinG: 2.5, carbsG: 5, fatG: 1 };
    expect(sumMacros([a, b])).toEqual({ kcal: 150, proteinG: 7.5, carbsG: 15, fatG: 3 });
  });
  it("lista vazia devolve zeros", () => {
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("computeRecipeTotals", () => {
  it("soma ingredientes e divide pelo rendimento (por porção)", () => {
    const totals = computeRecipeTotals(
      [
        { quantityG: 200, ingredient: arroz },
        { quantityG: 150, ingredient: frango },
      ],
      2,
    );
    // 200g arroz = 248 kcal, 5.2 P, 51.6 C, 2 G · 150g frango = 238.5 kcal, 48 P, 0 C, 3.75 G
    // total 486.5 / 2 porções = 243.3 (round1)
    expect(totals).toEqual({ kcal: 243.3, proteinG: 26.6, carbsG: 25.8, fatG: 2.9 });
  });
  it("rendimento <= 0 lança erro", () => {
    expect(() => computeRecipeTotals([{ quantityG: 100, ingredient: arroz }], 0)).toThrow();
  });
});

import { computeDayBalance } from "./nutrition";

describe("computeDayBalance", () => {
  const targets = { kcal: 1800, proteinG: 130, carbsG: 180, fatG: 60 };

  it("soma consumido e calcula restante", () => {
    const balance = computeDayBalance(targets, [
      { kcal: 418, proteinG: 22, carbsG: 51, fatG: 12 },
      { kcal: 645, proteinG: 48, carbsG: 52, fatG: 18 },
    ]);
    expect(balance.consumed).toEqual({ kcal: 1063, proteinG: 70, carbsG: 103, fatG: 30 });
    expect(balance.remaining).toEqual({ kcal: 737, proteinG: 60, carbsG: 77, fatG: 30 });
  });

  it("restante pode ficar negativo (estourou a meta)", () => {
    const balance = computeDayBalance(targets, [
      { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 80 },
    ]);
    expect(balance.remaining.kcal).toBe(-200);
    expect(balance.remaining.fatG).toBe(-20);
  });

  it("dia sem registros devolve as metas inteiras", () => {
    const balance = computeDayBalance(targets, []);
    expect(balance.remaining).toEqual(targets);
    expect(balance.consumed).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});
