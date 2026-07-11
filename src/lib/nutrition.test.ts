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

import { fitPortionToTarget, computeExternalVerdict, TOLERANCES } from "./nutrition";

describe("fitPortionToTarget", () => {
  const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

  it("encontra fator em passos de 0,25 que cabe na tolerância", () => {
    const perServing = { kcal: 516, proteinG: 38.4, carbsG: 41.6, fatG: 14.4 };
    const fit = fitPortionToTarget(targets, perServing);
    // 650/516 = 1.26 → 1.25; kcal 645 (dentro de ±5%), macros dentro de ±10%
    expect(fit.factor).toBe(1.25);
    expect(fit.fits).toBe(true);
    expect(fit.macros.kcal).toBe(645);
  });

  it("clampa o fator ao intervalo [0.5, 2]", () => {
    const tiny = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 3 };
    const fit = fitPortionToTarget(targets, tiny);
    expect(fit.factor).toBe(2);
    expect(fit.fits).toBe(false); // 200 kcal está longe de 650
  });

  it("macro com meta 0 é ignorada na checagem", () => {
    const zeroCarbTarget = { kcal: 400, proteinG: 30, carbsG: 0, fatG: 15 };
    const perServing = { kcal: 400, proteinG: 30, carbsG: 12, fatG: 15 };
    expect(fitPortionToTarget(zeroCarbTarget, perServing).fits).toBe(true);
  });

  it("kcal por porção <= 0 não cabe", () => {
    const fit = fitPortionToTarget(targets, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    expect(fit.fits).toBe(false);
  });
});

describe("computeExternalVerdict", () => {
  const targets = { kcal: 650, proteinG: 45, carbsG: 70, fatG: 20 };

  it("FITS quando cabe praticamente inteira (fator ~1)", () => {
    const v = computeExternalVerdict(targets, { kcal: 640, proteinG: 44, carbsG: 68, fatG: 21 });
    expect(v.verdict).toBe("FITS");
    expect(v.factor).toBe(1);
  });

  it("FITS_WITH_PORTION quando cabe com fator diferente de 1", () => {
    const v = computeExternalVerdict(targets, { kcal: 860, proteinG: 60, carbsG: 92, fatG: 26 });
    expect(v.verdict).toBe("FITS_WITH_PORTION");
    expect(v.factor).toBe(0.75);
  });

  it("DOES_NOT_FIT com o motivo do macro que estoura", () => {
    // gordura desproporcional: em nenhum fator os dois cabem
    const v = computeExternalVerdict(targets, { kcal: 650, proteinG: 10, carbsG: 20, fatG: 55 });
    expect(v.verdict).toBe("DOES_NOT_FIT");
    expect(v.reason).toContain("gordura");
  });
});
