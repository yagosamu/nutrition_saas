import Link from "next/link";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "@/lib/types";
import { prisma } from "@/server/db";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "Aprovada", className: "bg-brand-100 text-brand-600" },
  PENDING_REVIEW: { label: "Em curadoria", className: "bg-caramel-200 text-ink-900" },
  PRIVATE: { label: "Privada", className: "bg-cream-200 text-ink-500" },
};

const ORIGIN_LABEL: Record<string, string> = {
  TEAM: "Equipe",
  AI_GENERATED: "IA",
  EXTERNAL: "Externa",
};

const STATUSES = ["APPROVED", "PENDING_REVIEW", "PRIVATE"] as const;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mealType?: string }>;
}) {
  const { status = "", mealType = "" } = await searchParams;

  const where = {
    ...(STATUSES.includes(status as (typeof STATUSES)[number])
      ? { status: status as (typeof STATUSES)[number] }
      : {}),
    ...(MEAL_TYPES.includes(mealType as MealType)
      ? { suitableMealTypes: { has: mealType as MealType } }
      : {}),
  };

  const [recipes, pendingCount] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.recipe.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            Receitas
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Macros sempre somados dos ingredientes — nunca editados à mão.
          </p>
        </div>
        <Link
          href="/admin/recipes/new"
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600"
        >
          Nova receita
        </Link>
      </div>

      {pendingCount > 0 && (
        <Link
          href="/admin/recipes?status=PENDING_REVIEW"
          className="mt-6 inline-block rounded-full border-2 border-caramel-500 bg-caramel-200/50 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-caramel-200"
        >
          ⏳ Fila de curadoria ({pendingCount})
        </Link>
      )}

      <form method="GET" className="mt-4 flex gap-3">
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="APPROVED">Aprovadas</option>
          <option value="PENDING_REVIEW">Em curadoria</option>
          <option value="PRIVATE">Privadas</option>
        </select>
        <select
          name="mealType"
          defaultValue={mealType}
          className="rounded-lg border border-line-200 bg-cream-50 px-3 py-2 text-sm"
        >
          <option value="">Todas as refeições</option>
          {MEAL_TYPES.map((mt) => (
            <option key={mt} value={mt}>
              {MEAL_TYPE_LABELS[mt]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-line-200 px-4 py-2 text-sm text-ink-500 hover:text-brand-600"
        >
          Filtrar
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-wider text-ink-300">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Refeições</th>
              <th className="px-4 py-3 text-right font-medium">kcal/porção</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Origem</th>
            </tr>
          </thead>
          <tbody>
            {recipes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                  Nenhuma receita ainda — crie a primeira.
                </td>
              </tr>
            )}
            {recipes.map((recipe) => {
              const badge = STATUS_BADGE[recipe.status] ?? STATUS_BADGE.PRIVATE;
              return (
                <tr
                  key={recipe.id}
                  className="border-b border-line-200 last:border-0 hover:bg-cream-100"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/recipes/${recipe.id}`}
                      className="block font-medium text-ink-900 hover:text-brand-600"
                    >
                      {recipe.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">
                    {recipe.suitableMealTypes
                      .map((mt) => MEAL_TYPE_LABELS[mt as MealType])
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display font-semibold">
                    {recipe.kcalPerServing}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">
                    {ORIGIN_LABEL[recipe.origin] ?? recipe.origin}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
