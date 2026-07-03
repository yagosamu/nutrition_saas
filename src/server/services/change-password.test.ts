import { compareSync, hashSync } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { changePasswordWith, type ChangePasswordDeps } from "./change-password";

const currentPassword = "senha-atual";

function makeDeps(overrides?: Partial<ChangePasswordDeps>) {
  const updates: { id: string; hash: string }[] = [];
  const deps: ChangePasswordDeps = {
    findUser: async () => ({ passwordHash: hashSync(currentPassword, 4) }),
    updatePassword: async (id, hash) => {
      updates.push({ id, hash });
    },
    ...overrides,
  };
  return { deps, updates };
}

describe("changePasswordWith", () => {
  it("troca a senha quando a atual confere", async () => {
    const { deps, updates } = makeDeps();
    const result = await changePasswordWith(deps, "u1", currentPassword, "nova-senha-123");
    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("u1");
    expect(compareSync("nova-senha-123", updates[0].hash)).toBe(true);
  });

  it("recusa quando a senha atual está errada", async () => {
    const { deps, updates } = makeDeps();
    const result = await changePasswordWith(deps, "u1", "errada", "nova-senha-123");
    expect(result).toEqual({ ok: false, error: "Senha atual incorreta" });
    expect(updates).toHaveLength(0);
  });

  it("recusa quando o usuário não existe", async () => {
    const { deps } = makeDeps({ findUser: async () => null });
    const result = await changePasswordWith(deps, "u1", currentPassword, "nova-senha-123");
    expect(result).toEqual({ ok: false, error: "Usuário não encontrado" });
  });
});
