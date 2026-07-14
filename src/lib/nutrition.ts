// Matemática nutricional pura e isomórfica (client + server).
// ÚNICA fonte de cálculo de macros do sistema — nunca duplicar esta aritmética.
import type { AdherenceStats, IngredientMacros, MacroTotals } from "./types";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scalePer100(macros: IngredientMacros, grams: number): MacroTotals {
  const f = grams / 100;
  return {
    kcal: round1(macros.kcalPer100g * f),
    proteinG: round1(macros.proteinGPer100g * f),
    carbsG: round1(macros.carbsGPer100g * f),
    fatG: round1(macros.fatGPer100g * f),
  };
}

export function scaleServing(perServing: MacroTotals, servings: number): MacroTotals {
  return {
    kcal: round1(perServing.kcal * servings),
    proteinG: round1(perServing.proteinG * servings),
    carbsG: round1(perServing.carbsG * servings),
    fatG: round1(perServing.fatG * servings),
  };
}

export function sumMacros(list: MacroTotals[]): MacroTotals {
  return list.reduce(
    (acc, m) => ({
      kcal: round1(acc.kcal + m.kcal),
      proteinG: round1(acc.proteinG + m.proteinG),
      carbsG: round1(acc.carbsG + m.carbsG),
      fatG: round1(acc.fatG + m.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export type RecipeIngredientAmount = {
  quantityG: number;
  ingredient: IngredientMacros;
};

export function computeRecipeTotals(
  items: RecipeIngredientAmount[],
  servings: number,
): MacroTotals {
  if (servings <= 0) throw new Error("Rendimento deve ser positivo");
  const total = sumMacros(items.map((i) => scalePer100(i.ingredient, i.quantityG)));
  return {
    kcal: round1(total.kcal / servings),
    proteinG: round1(total.proteinG / servings),
    carbsG: round1(total.carbsG / servings),
    fatG: round1(total.fatG / servings),
  };
}

import type { DayBalance } from "./types";

export function computeDayBalance(
  targets: MacroTotals,
  consumedList: MacroTotals[],
): DayBalance {
  const consumed = sumMacros(consumedList);
  return {
    targets,
    consumed,
    remaining: {
      kcal: round1(targets.kcal - consumed.kcal),
      proteinG: round1(targets.proteinG - consumed.proteinG),
      carbsG: round1(targets.carbsG - consumed.carbsG),
      fatG: round1(targets.fatG - consumed.fatG),
    },
  };
}

// Tolerâncias do produto (design doc): kcal ±5%, macros ±10% (relativas à meta).
export const TOLERANCES = { kcalPct: 0.05, macroPct: 0.1 } as const;

export type PortionFit = {
  factor: number;
  macros: MacroTotals;
  fits: boolean;
};

function withinTolerance(value: number, target: number, pct: number): boolean {
  if (target <= 0) return true; // meta 0 = não avaliada
  return Math.abs(value - target) <= target * pct;
}

function fitsTargets(macros: MacroTotals, targets: MacroTotals): boolean {
  return (
    withinTolerance(macros.kcal, targets.kcal, TOLERANCES.kcalPct) &&
    withinMacroCeiling(macros.proteinG, targets.proteinG) &&
    withinMacroCeiling(macros.carbsG, targets.carbsG) &&
    withinMacroCeiling(macros.fatG, targets.fatG)
  );
}

function withinMacroCeiling(value: number, target: number): boolean {
  if (target <= 0) return true; // meta 0 = não avaliada
  return value <= target * (1 + TOLERANCES.macroPct);
}

/**
 * Encontra o fator de porção (passos de 0,25 em [0,5, 2]) que melhor aproxima
 * a meta de kcal e verifica as tolerâncias. Determinístico — nunca LLM.
 */
export function fitPortionToTarget(
  targets: MacroTotals,
  perServing: MacroTotals,
): PortionFit {
  if (perServing.kcal <= 0 || targets.kcal <= 0) {
    return { factor: 1, macros: scaleServing(perServing, 1), fits: false };
  }
  const raw = targets.kcal / perServing.kcal;
  const clamped = Math.min(2, Math.max(0.5, raw));
  const factor = Math.round(clamped * 4) / 4;
  const macros = scaleServing(perServing, factor);
  return { factor, macros, fits: fitsTargets(macros, targets) };
}

export type ExternalVerdict = {
  verdict: "FITS" | "FITS_WITH_PORTION" | "DOES_NOT_FIT";
  factor: number;
  macros: MacroTotals;
  reason: string | null;
};

const MACRO_LABELS: [keyof MacroTotals, string][] = [
  ["kcal", "as calorias"],
  ["proteinG", "a proteína"],
  ["carbsG", "o carboidrato"],
  ["fatG", "a gordura"],
];

export function computeExternalVerdict(
  targets: MacroTotals,
  perServing: MacroTotals,
): ExternalVerdict {
  const fit = fitPortionToTarget(targets, perServing);
  if (fit.fits) {
    return {
      verdict: fit.factor === 1 ? "FITS" : "FITS_WITH_PORTION",
      factor: fit.factor,
      macros: fit.macros,
      reason: null,
    };
  }
  const offender = MACRO_LABELS.find(([key]) =>
    key === "kcal"
      ? !withinTolerance(fit.macros[key], targets[key], TOLERANCES.kcalPct)
      : !withinMacroCeiling(fit.macros[key], targets[key]),
  );
  const label = offender?.[1] ?? "as metas";
  const over = offender ? fit.macros[offender[0]] > targets[offender[0]] : true;
  return {
    verdict: "DOES_NOT_FIT",
    factor: fit.factor,
    macros: fit.macros,
    reason: `Mesmo na melhor porção, ${label} fica${over ? "m acima" : "m abaixo"} da meta desta refeição`,
  };
}

export function computeAdherence(
  slotsPerDay: number,
  windowDays: number,
  loggedCount: number,
): AdherenceStats {
  const expected = slotsPerDay * windowDays;
  const pct = expected <= 0 ? 0 : Math.min(100, Math.round((loggedCount / expected) * 100));
  return { windowDays, expected, logged: Math.min(loggedCount, expected), pct };
}
