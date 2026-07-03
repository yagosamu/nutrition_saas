import { hashSync } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { validateLoginWith, type UserRecord } from "./login";

const password = "senha-correta";
const user: UserRecord = {
  id: "u1",
  email: "ana@example.com",
  name: "Ana",
  role: "PATIENT",
  mustChangePassword: false,
  active: true,
  passwordHash: hashSync(password, 4),
};

const findUser = (record: UserRecord | null) => async (_email: string) => record;

describe("validateLoginWith", () => {
  it("retorna o usuário (sem hash) com credenciais válidas", async () => {
    const result = await validateLoginWith(findUser(user), "ana@example.com", password);
    expect(result).toEqual({
      id: "u1",
      email: "ana@example.com",
      name: "Ana",
      role: "PATIENT",
      mustChangePassword: false,
    });
  });

  it("normaliza o email (trim + lowercase) antes de buscar", async () => {
    let searched = "";
    const spy = async (email: string) => {
      searched = email;
      return user;
    };
    await validateLoginWith(spy, "  ANA@Example.com ", password);
    expect(searched).toBe("ana@example.com");
  });

  it("retorna null com senha errada", async () => {
    expect(await validateLoginWith(findUser(user), "ana@example.com", "errada")).toBeNull();
  });

  it("retorna null se o usuário não existe", async () => {
    expect(await validateLoginWith(findUser(null), "x@example.com", password)).toBeNull();
  });

  it("retorna null se o usuário está inativo", async () => {
    const inactive = { ...user, active: false };
    expect(await validateLoginWith(findUser(inactive), "ana@example.com", password)).toBeNull();
  });
});
