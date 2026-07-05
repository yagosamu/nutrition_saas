import Link from "next/link";
import { prisma } from "@/server/db";

const PAGE_SIZE = 50;

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  TACO: { label: "TACO", className: "bg-caramel-200 text-ink-900" },
  TBCA: { label: "TBCA", className: "bg-cream-200 text-ink-500" },
  CUSTOM: { label: "Próprio", className: "bg-brand-100 text-brand-600" },
};

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page = "1" } = await searchParams;
  const query = q.trim();
  const pageNum = Math.max(1, Number(page) || 1);
  const where = query
    ? { name: { contains: query, mode: "insensitive" as const } }
    : {};

  const [items, total] = await Promise.all([
    prisma.ingredient.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ingredient.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            Ingredientes
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {total} ingredientes no banco · macros por 100 g
          </p>
        </div>
        <Link
          href="/admin/ingredients/new"
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600"
        >
          Novo ingrediente
        </Link>
      </div>

      <form method="GET" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Buscar por nome…"
          className="w-full max-w-md rounded-lg border border-line-200 bg-cream-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-wider text-ink-300">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Fonte</th>
              <th className="px-4 py-3 text-right font-medium">kcal</th>
              <th className="px-4 py-3 text-right font-medium">Proteína</th>
              <th className="px-4 py-3 text-right font-medium">Carbo</th>
              <th className="px-4 py-3 text-right font-medium">Gordura</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                  Nenhum ingrediente encontrado{query ? ` para "${query}"` : ""}.
                </td>
              </tr>
            )}
            {items.map((ing) => {
              const badge = SOURCE_BADGE[ing.source] ?? SOURCE_BADGE.CUSTOM;
              return (
                <tr
                  key={ing.id}
                  className="border-b border-line-200 last:border-0 hover:bg-cream-100"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/ingredients/${ing.id}`}
                      className="block font-medium text-ink-900 hover:text-brand-600"
                    >
                      {ing.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-display font-semibold">
                    {ing.kcalPer100g}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-500">
                    {ing.proteinGPer100g} g
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-500">
                    {ing.carbsGPer100g} g
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-500">
                    {ing.fatGPer100g} g
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm text-ink-500">
          {pageNum > 1 && (
            <Link
              href={`/admin/ingredients?q=${encodeURIComponent(query)}&page=${pageNum - 1}`}
              className="rounded-lg border border-line-200 bg-cream-50 px-3 py-1.5 hover:text-brand-600"
            >
              ← Anterior
            </Link>
          )}
          <span>
            Página {pageNum} de {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link
              href={`/admin/ingredients?q=${encodeURIComponent(query)}&page=${pageNum + 1}`}
              className="rounded-lg border border-line-200 bg-cream-50 px-3 py-1.5 hover:text-brand-600"
            >
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
