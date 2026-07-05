"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { scalePer100, scaleServing, sumMacros, round1 } from "@/lib/nutrition";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type IngredientMacros,
  type MacroTotals,
  type MealType,
} from "@/lib/types";
import { InlineSearch } from "../../../inline-search";
import { saveMealPlanAction } from "./actions";

type ItemSource =
  | { kind: "ingredient"; macros: IngredientMacros }
  | { kind: "recipe"; perServing: MacroTotals };

type EditorItem = {
  ingredientId: string | null;
  quantityG: number | null;
  recipeId: string | null;
  servings: number | null;
  label: string;
  source: ItemSource;
};

type EditorSlot = {
  key: string;
  id: string | null;
  name: string;
  mealType: MealType;
  timeHint: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  items: EditorItem[];
};

export type EditorInitial = {
  dailyKcal: number;
  dailyProteinG: number;
  dailyCarbsG: number;
  dailyFatG: number;
  slots: Omit<EditorSlot, "key">[];
};

type SearchIngredient = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
};

type SearchRecipe = {
  id: string;
  name: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
};

const DEFAULT_SLOTS: { name: string; mealType: MealType }[] = [
  { name: "Café da manhã", mealType: "BREAKFAST" },
  { name: "Almoço", mealType: "LUNCH" },
  { name: "Lanche da tarde", mealType: "AFTERNOON_SNACK" },
  { name: "Jantar", mealType: "DINNER" },
];

function newKey() {
  return crypto.randomUUID();
}

function itemMacros(item: EditorItem): MacroTotals {
  if (item.source.kind === "ingredient") {
    return scalePer100(item.source.macros, item.quantityG ?? 0);
  }
  return scaleServing(item.source.perServing, item.servings ?? 0);
}

const inputClass =
  "w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
const smallInput =
  "w-full rounded-md border border-line-200 bg-cream-50 px-2 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none";

export function PlanEditor({
  patientId,
  initial,
}: {
  patientId: string;
  initial: EditorInitial | null;
}) {
  const router = useRouter();
  const [daily, setDaily] = useState({
    dailyKcal: initial?.dailyKcal ?? 0,
    dailyProteinG: initial?.dailyProteinG ?? 0,
    dailyCarbsG: initial?.dailyCarbsG ?? 0,
    dailyFatG: initial?.dailyFatG ?? 0,
  });
  const [slots, setSlots] = useState<EditorSlot[]>(() =>
    initial
      ? initial.slots.map((s) => ({ ...s, key: newKey() }))
      : DEFAULT_SLOTS.map((d) => ({
          key: newKey(),
          id: null,
          name: d.name,
          mealType: d.mealType,
          timeHint: null,
          kcal: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          items: [],
        })),
  );
  const [pickerFor, setPickerFor] = useState<{ key: string; kind: "ingredient" | "recipe" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const slotTargetSum = useMemo(
    () =>
      sumMacros(
        slots.map((s) => ({ kcal: s.kcal, proteinG: s.proteinG, carbsG: s.carbsG, fatG: s.fatG })),
      ),
    [slots],
  );
  const kcalDelta = round1(slotTargetSum.kcal - daily.dailyKcal);

  function patchSlot(key: string, patch: Partial<EditorSlot>) {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function moveSlot(key: string, direction: -1 | 1) {
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function removeSlot(key: string) {
    setSlots((prev) => prev.filter((s) => s.key !== key));
  }

  function addSlot() {
    setSlots((prev) => [
      ...prev,
      {
        key: newKey(),
        id: null,
        name: "Nova refeição",
        mealType: "AFTERNOON_SNACK",
        timeHint: null,
        kcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        items: [],
      },
    ]);
  }

  function addIngredientItem(slotKey: string, item: SearchIngredient) {
    setSlots((prev) =>
      prev.map((s) =>
        s.key === slotKey
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  ingredientId: item.id,
                  quantityG: 100,
                  recipeId: null,
                  servings: null,
                  label: item.name,
                  source: {
                    kind: "ingredient",
                    macros: {
                      kcalPer100g: item.kcalPer100g,
                      proteinGPer100g: item.proteinGPer100g,
                      carbsGPer100g: item.carbsGPer100g,
                      fatGPer100g: item.fatGPer100g,
                    },
                  },
                },
              ],
            }
          : s,
      ),
    );
    setPickerFor(null);
  }

  function addRecipeItem(slotKey: string, item: SearchRecipe) {
    setSlots((prev) =>
      prev.map((s) =>
        s.key === slotKey
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  ingredientId: null,
                  quantityG: null,
                  recipeId: item.id,
                  servings: 1,
                  label: item.name,
                  source: {
                    kind: "recipe",
                    perServing: {
                      kcal: item.kcalPerServing,
                      proteinG: item.proteinGPerServing,
                      carbsG: item.carbsGPerServing,
                      fatG: item.fatGPerServing,
                    },
                  },
                },
              ],
            }
          : s,
      ),
    );
    setPickerFor(null);
  }

  function patchItem(slotKey: string, index: number, patch: Partial<EditorItem>) {
    setSlots((prev) =>
      prev.map((s) =>
        s.key === slotKey
          ? { ...s, items: s.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }
          : s,
      ),
    );
  }

  function removeItem(slotKey: string, index: number) {
    setSlots((prev) =>
      prev.map((s) =>
        s.key === slotKey ? { ...s, items: s.items.filter((_, i) => i !== index) } : s,
      ),
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const payload = {
        ...daily,
        slots: slots.map((s, order) => ({
          id: s.id,
          name: s.name,
          order,
          mealType: s.mealType,
          timeHint: s.timeHint,
          kcal: s.kcal,
          proteinG: s.proteinG,
          carbsG: s.carbsG,
          fatG: s.fatG,
          items: s.items.map((i) => ({
            ingredientId: i.ingredientId,
            quantityG: i.quantityG,
            recipeId: i.recipeId,
            servings: i.servings,
          })),
        })),
      };
      const result = await saveMealPlanAction(patientId, payload);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-line-200 bg-cream-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Metas diárias
        </p>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {(
            [
              ["dailyKcal", "kcal"],
              ["dailyProteinG", "Proteína (g)"],
              ["dailyCarbsG", "Carbo (g)"],
              ["dailyFatG", "Gordura (g)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="flex flex-col gap-1 text-xs font-medium text-ink-500">
              {label}
              <input
                type="number"
                min={0}
                value={daily[field]}
                onChange={(e) => setDaily((d) => ({ ...d, [field]: Number(e.target.value) }))}
                className={smallInput}
              />
            </label>
          ))}
        </div>
        {daily.dailyKcal > 0 && kcalDelta !== 0 && (
          <p className="mt-3 rounded-lg bg-caramel-200 px-3 py-2 text-xs text-ink-900">
            As refeições somam <strong>{slotTargetSum.kcal} kcal</strong> —{" "}
            {kcalDelta > 0 ? `${kcalDelta} acima` : `${Math.abs(kcalDelta)} abaixo`} da meta
            diária. Só um aviso, dá para salvar assim.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {slots.map((slot, slotIndex) => {
          const base = sumMacros(slot.items.map(itemMacros));
          return (
            <div key={slot.key} className="rounded-xl border border-line-200 bg-cream-50 p-5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={slot.name}
                  onChange={(e) => patchSlot(slot.key, { name: e.target.value })}
                  className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-lg font-semibold text-ink-900 hover:border-line-200 focus:border-brand-500 focus:outline-none"
                />
                <select
                  value={slot.mealType}
                  onChange={(e) => patchSlot(slot.key, { mealType: e.target.value as MealType })}
                  className="rounded-lg border border-line-200 bg-cream-50 px-2 py-1.5 text-xs"
                >
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {MEAL_TYPE_LABELS[mt]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="hh:mm"
                  value={slot.timeHint ?? ""}
                  onChange={(e) => patchSlot(slot.key, { timeHint: e.target.value || null })}
                  className="w-20 rounded-lg border border-line-200 bg-cream-50 px-2 py-1.5 text-center text-xs"
                />
                <button
                  type="button"
                  onClick={() => moveSlot(slot.key, -1)}
                  disabled={slotIndex === 0}
                  aria-label="Mover para cima"
                  className="rounded px-1.5 text-ink-300 hover:text-ink-900 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSlot(slot.key, 1)}
                  disabled={slotIndex === slots.length - 1}
                  aria-label="Mover para baixo"
                  className="rounded px-1.5 text-ink-300 hover:text-ink-900 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeSlot(slot.key)}
                  aria-label={`Remover ${slot.name}`}
                  className="rounded px-1.5 text-ink-300 hover:text-red-700"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-3">
                {(
                  [
                    ["kcal", "Meta kcal"],
                    ["proteinG", "Proteína (g)"],
                    ["carbsG", "Carbo (g)"],
                    ["fatG", "Gordura (g)"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="flex flex-col gap-1 text-xs font-medium text-ink-500">
                    {label}
                    <input
                      type="number"
                      min={0}
                      value={slot[field]}
                      onChange={(e) => patchSlot(slot.key, { [field]: Number(e.target.value) })}
                      className={smallInput}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 border-t border-line-200 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                    Dieta base
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerFor({ key: slot.key, kind: "ingredient" })}
                      className="rounded-full border border-line-200 px-3 py-1 text-xs text-ink-500 hover:border-brand-500 hover:text-brand-600"
                    >
                      + Ingrediente
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerFor({ key: slot.key, kind: "recipe" })}
                      className="rounded-full border border-line-200 px-3 py-1 text-xs text-ink-500 hover:border-brand-500 hover:text-brand-600"
                    >
                      + Receita
                    </button>
                  </div>
                </div>

                {pickerFor?.key === slot.key && (
                  <div className="mt-2">
                    {pickerFor.kind === "ingredient" ? (
                      <InlineSearch<SearchIngredient>
                        endpoint="/api/admin/ingredients/search"
                        placeholder="Buscar ingrediente…"
                        onPick={(item) => addIngredientItem(slot.key, item)}
                        autoFocus
                      />
                    ) : (
                      <InlineSearch<SearchRecipe>
                        endpoint="/api/admin/recipes/search"
                        placeholder="Buscar receita aprovada…"
                        onPick={(item) => addRecipeItem(slot.key, item)}
                        autoFocus
                      />
                    )}
                  </div>
                )}

                <ul className="mt-2 space-y-1.5">
                  {slot.items.map((item, index) => {
                    const m = itemMacros(item);
                    return (
                      <li
                        key={`${item.ingredientId ?? item.recipeId}-${index}`}
                        className="flex items-center gap-3 rounded-lg bg-cream-100 px-3 py-1.5 text-sm"
                      >
                        <span className="flex-1 truncate text-ink-900">{item.label}</span>
                        {item.source.kind === "ingredient" ? (
                          <>
                            <input
                              type="number"
                              min={1}
                              value={item.quantityG ?? 0}
                              onChange={(e) =>
                                patchItem(slot.key, index, { quantityG: Number(e.target.value) })
                              }
                              className="w-16 rounded-md border border-line-200 bg-cream-50 px-2 py-0.5 text-right text-xs"
                            />
                            <span className="w-3 text-xs text-ink-300">g</span>
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              min={0.25}
                              step={0.25}
                              value={item.servings ?? 0}
                              onChange={(e) =>
                                patchItem(slot.key, index, { servings: Number(e.target.value) })
                              }
                              className="w-16 rounded-md border border-line-200 bg-cream-50 px-2 py-0.5 text-right text-xs"
                            />
                            <span className="w-8 text-xs text-ink-300">porç.</span>
                          </>
                        )}
                        <span className="w-16 text-right text-xs text-ink-500">{m.kcal} kcal</span>
                        <button
                          type="button"
                          onClick={() => removeItem(slot.key, index)}
                          aria-label={`Remover ${item.label}`}
                          className="text-ink-300 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-2 text-xs text-ink-500">
                  Dieta base: <strong>{base.kcal} kcal</strong> · {base.proteinG}P ·{" "}
                  {base.carbsG}C · {base.fatG}G
                  {slot.kcal > 0 && <> — alvo {slot.kcal} kcal</>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addSlot}
        className="mt-4 w-full rounded-xl border border-dashed border-line-200 py-3 text-sm text-ink-500 hover:border-brand-500 hover:text-brand-600"
      >
        + Adicionar refeição
      </button>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-3 text-sm text-brand-600">Plano salvo.</p>}

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || slots.length === 0}
          className="rounded-full bg-brand-500 px-8 py-3 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar plano"}
        </button>
      </div>
    </div>
  );
}
