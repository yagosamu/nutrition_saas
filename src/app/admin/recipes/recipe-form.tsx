"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { computeRecipeTotals, scalePer100 } from "@/lib/nutrition";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type IngredientMacros,
  type MealType,
} from "@/lib/types";
import { InlineSearch } from "../inline-search";
import { saveRecipeAction } from "./actions";

type ComposerIngredient = {
  ingredientId: string;
  name: string;
  macros: IngredientMacros;
  quantityG: number;
};

type SearchIngredient = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
};

export type RecipeFormInitial = {
  name: string;
  instructions: string;
  servings: number;
  suitableMealTypes: MealType[];
  ingredients: ComposerIngredient[];
};

const inputClass =
  "w-full rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-ink-900";

export function RecipeForm({
  id,
  initial,
}: {
  id: string | null;
  initial?: RecipeFormInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [servings, setServings] = useState(initial?.servings ?? 1);
  const [mealTypes, setMealTypes] = useState<MealType[]>(
    initial?.suitableMealTypes ?? [],
  );
  const [ingredients, setIngredients] = useState<ComposerIngredient[]>(
    initial?.ingredients ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Totais ao vivo — a MESMA função pura que o servidor usa como autoridade.
  const totals = useMemo(
    () =>
      ingredients.length > 0 && servings > 0
        ? computeRecipeTotals(
            ingredients.map((i) => ({
              quantityG: i.quantityG,
              ingredient: i.macros,
            })),
            servings,
          )
        : null,
    [ingredients, servings],
  );

  function toggleMealType(mt: MealType) {
    setMealTypes((prev) =>
      prev.includes(mt) ? prev.filter((m) => m !== mt) : [...prev, mt],
    );
  }

  function addIngredient(item: SearchIngredient) {
    setIngredients((prev) => [
      ...prev,
      {
        ingredientId: item.id,
        name: item.name,
        macros: {
          kcalPer100g: item.kcalPer100g,
          proteinGPer100g: item.proteinGPer100g,
          carbsGPer100g: item.carbsGPer100g,
          fatGPer100g: item.fatGPer100g,
        },
        quantityG: 100,
      },
    ]);
  }

  function updateQuantity(ingredientId: string, quantityG: number) {
    setIngredients((prev) =>
      prev.map((i) => (i.ingredientId === ingredientId ? { ...i, quantityG } : i)),
    );
  }

  function removeIngredient(ingredientId: string) {
    setIngredients((prev) => prev.filter((i) => i.ingredientId !== ingredientId));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveRecipeAction(id, {
        name,
        instructions,
        servings,
        suitableMealTypes: mealTypes,
        ingredients: ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          quantityG: i.quantityG,
        })),
      });
      if (result.ok) {
        router.push("/admin/recipes");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-xl border border-line-200 bg-cream-50 p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <label className={labelClass}>
            Nome da receita
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Rendimento (porções)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Tipos de refeição adequados
        </p>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => toggleMealType(mt)}
              className={
                mealTypes.includes(mt)
                  ? "rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-cream-50"
                  : "rounded-full border border-line-200 px-3.5 py-1.5 text-xs text-ink-500 hover:border-brand-500 hover:text-brand-600"
              }
            >
              {MEAL_TYPE_LABELS[mt]}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Ingredientes
        </p>
        <InlineSearch<SearchIngredient>
          endpoint="/api/admin/ingredients/search"
          placeholder="Buscar ingrediente para adicionar…"
          excludeIds={ingredients.map((i) => i.ingredientId)}
          onPick={addIngredient}
        />
        <ul className="mt-3 flex flex-col gap-2">
          {ingredients.map((ing) => {
            const line = scalePer100(ing.macros, ing.quantityG);
            return (
              <li
                key={ing.ingredientId}
                className="flex items-center gap-3 rounded-lg border border-line-200 bg-cream-100 px-3 py-2"
              >
                <span className="flex-1 truncate text-sm font-medium text-ink-900">
                  {ing.name}
                </span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={ing.quantityG}
                  onChange={(e) =>
                    updateQuantity(ing.ingredientId, Number(e.target.value))
                  }
                  className="w-20 rounded-md border border-line-200 bg-cream-50 px-2 py-1 text-right text-sm"
                />
                <span className="w-4 text-xs text-ink-300">g</span>
                <span className="w-32 text-right text-xs text-ink-500">
                  {line.kcal} kcal · {line.proteinG}P
                </span>
                <button
                  type="button"
                  onClick={() => removeIngredient(ing.ingredientId)}
                  aria-label={`Remover ${ing.name}`}
                  className="text-ink-300 hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            );
          })}
          {ingredients.length === 0 && (
            <li className="rounded-lg border border-dashed border-line-200 px-3 py-4 text-center text-sm text-ink-300">
              Nenhum ingrediente — os macros da receita nascem daqui.
            </li>
          )}
        </ul>

        <label className={`${labelClass} mt-6`}>
          Modo de preparo
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            className={inputClass}
          />
        </label>
      </div>

      <div className="h-fit rounded-xl bg-charcoal-900 p-5 text-cream-100 lg:sticky lg:top-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
          Por porção
        </p>
        {totals ? (
          <>
            <p className="mt-2 font-display text-3xl font-semibold">
              {totals.kcal}{" "}
              <span className="text-base font-normal text-caramel-200">kcal</span>
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between border-b border-charcoal-900 pb-1">
                <dt className="text-caramel-200">Proteína</dt>
                <dd className="font-display font-semibold">{totals.proteinG} g</dd>
              </div>
              <div className="flex justify-between border-b border-charcoal-900 pb-1">
                <dt className="text-caramel-200">Carboidrato</dt>
                <dd className="font-display font-semibold">{totals.carbsG} g</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-caramel-200">Gordura</dt>
                <dd className="font-display font-semibold">{totals.fatG} g</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-3 text-sm text-caramel-200">
            Adicione ingredientes para ver os macros calculados.
          </p>
        )}
        <p className="mt-5 text-[11px] leading-relaxed text-caramel-200/80">
          Somado ingrediente a ingrediente — o valor persistido é recalculado
          pelo servidor com a mesma matemática.
        </p>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="mt-5 w-full rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Salvando…" : id ? "Salvar alterações" : "Criar receita"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/recipes")}
          className="mt-2 w-full rounded-full border border-charcoal-900 py-2 text-sm text-caramel-200 hover:text-cream-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
