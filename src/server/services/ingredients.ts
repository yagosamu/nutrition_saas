import type { ActionResult } from "@/lib/types";
import type { IngredientInputData } from "@/lib/validation/ingredient";
import { prisma } from "@/server/db";

export type IngredientDeps = {
  findByName: (name: string) => Promise<{ id: string } | null>;
  create: (data: IngredientInputData & { source: "CUSTOM" }) => Promise<{ id: string }>;
  update: (id: string, data: IngredientInputData) => Promise<void>;
};

export async function saveCustomIngredientWith(
  deps: IngredientDeps,
  input: IngredientInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  const name = input.name.trim();
  const existing = await deps.findByName(name);
  if (existing && existing.id !== id) {
    return { ok: false, error: "Já existe um ingrediente com esse nome" };
  }
  if (id) {
    await deps.update(id, { ...input, name });
    return { ok: true, data: { id } };
  }
  const created = await deps.create({ ...input, name, source: "CUSTOM" });
  return { ok: true, data: { id: created.id } };
}

export function saveCustomIngredient(
  input: IngredientInputData,
  id: string | null,
): Promise<ActionResult<{ id: string }>> {
  return saveCustomIngredientWith(
    {
      findByName: (name) =>
        prisma.ingredient.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } }),
      create: (data) => prisma.ingredient.create({ data, select: { id: true } }),
      update: async (ingredientId, data) => {
        await prisma.ingredient.update({ where: { id: ingredientId }, data });
      },
    },
    input,
    id,
  );
}
