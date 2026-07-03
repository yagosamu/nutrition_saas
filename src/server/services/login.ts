import { compare } from "bcryptjs";
import type { AuthUser } from "@/lib/types";
import { prisma } from "@/server/db";

export type UserRecord = AuthUser & {
  passwordHash: string;
  active: boolean;
};

type FindUser = (email: string) => Promise<UserRecord | null>;

export async function validateLoginWith(
  findUser: FindUser,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await findUser(email.trim().toLowerCase());
  if (!user || !user.active) return null;

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) return null;

  const { passwordHash: _hash, active: _active, ...authUser } = user;
  return authUser;
}

export function validateLogin(email: string, password: string): Promise<AuthUser | null> {
  return validateLoginWith(
    (normalizedEmail) =>
      prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          mustChangePassword: true,
          active: true,
          passwordHash: true,
        },
      }),
    email,
    password,
  );
}
