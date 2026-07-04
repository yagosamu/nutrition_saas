import { describe, expect, it } from "vitest";
import { saveCustomIngredientWith, type IngredientDeps } from "./ingredients";

function makeDeps() {
  const saved: unknown[] = [];
  const deps: IngredientDeps = {
    findByName: async () => null,
    create: async (data) => {
      saved.push(data);
      return { id: "i1" };
    },
    update: async (id, data) => {
      saved.push({ id, ...data });
    },
  };
  return { deps, saved };
}

describe("saveCustomIngredientWith", () => {
  const input = {
    name: "  Whey da marca X  ",
    kcalPer100g: 400,
    proteinGPer100g: 80,
    carbsGPer100g: 10,
    fatGPer100g: 5,
    fiberGPer100g: null,
  };

  it("cria ingrediente CUSTOM com nome normalizado", async () => {
    const { deps, saved } = makeDeps();
    const result = await saveCustomIngredientWith(deps, input, null);
    expect(result).toEqual({ ok: true, data: { id: "i1" } });
    expect(saved[0]).toMatchObject({ name: "Whey da marca X", source: "CUSTOM" });
  });

  it("recusa nome duplicado ao criar", async () => {
    const { deps } = makeDeps();
    deps.findByName = async () => ({ id: "outro" });
    const result = await saveCustomIngredientWith(deps, input, null);
    expect(result).toEqual({ ok: false, error: "Já existe um ingrediente com esse nome" });
  });

  it("atualiza quando recebe id (e permite o próprio nome)", async () => {
    const { deps, saved } = makeDeps();
    deps.findByName = async () => ({ id: "i1" });
    const result = await saveCustomIngredientWith(deps, input, "i1");
    expect(result.ok).toBe(true);
    expect(saved[0]).toMatchObject({ id: "i1", name: "Whey da marca X" });
  });
});
