import { compareSync } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { createPatientWith, resetPatientPasswordWith, type PatientCreateDeps } from "./patients";

const input = {
  name: "Ana Silva",
  email: "Ana@Example.com ",
  birthDate: null,
  sex: null,
  teamNotes: null,
};

function makeDeps() {
  const created: { email: string; passwordHash: string }[] = [];
  const deps: PatientCreateDeps = {
    findUserByEmail: async () => null,
    createPatient: async (data) => {
      created.push(data);
      return { id: "u1" };
    },
  };
  return { deps, created };
}

describe("createPatientWith", () => {
  it("cria paciente com email normalizado e senha provisória que confere com o hash", async () => {
    const { deps, created } = makeDeps();
    const result = await createPatientWith(deps, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(created[0].email).toBe("ana@example.com");
    expect(result.data.tempPassword).toHaveLength(12);
    expect(compareSync(result.data.tempPassword, created[0].passwordHash)).toBe(true);
  });

  it("recusa email já cadastrado", async () => {
    const { deps } = makeDeps();
    deps.findUserByEmail = async () => ({ id: "outro" });
    const result = await createPatientWith(deps, input);
    expect(result).toEqual({ ok: false, error: "Já existe um usuário com esse email" });
  });
});

describe("resetPatientPasswordWith", () => {
  it("gera nova senha provisória e marca mustChangePassword", async () => {
    let saved: { passwordHash: string; mustChangePassword: boolean } | null = null;
    const result = await resetPatientPasswordWith(
      { updatePassword: async (_id, data) => { saved = data; } },
      "u1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !saved) return;
    expect(saved.mustChangePassword).toBe(true);
    expect(compareSync(result.data.tempPassword, saved.passwordHash)).toBe(true);
  });
});
