import { compare, hash } from "bcryptjs";
import { prisma } from "@/server/db";

export type ChangePasswordDeps = {
  findUser: (id: string) => Promise<{ passwordHash: string } | null>;
  updatePassword: (id: string, passwordHash: string) => Promise<void>;
};

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changePasswordWith(
  deps: ChangePasswordDeps,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await deps.findUser(userId);
  if (!user) return { ok: false, error: "Usuário não encontrado" };

  const currentOk = await compare(currentPassword, user.passwordHash);
  if (!currentOk) return { ok: false, error: "Senha atual incorreta" };

  const newHash = await hash(newPassword, 12);
  await deps.updatePassword(userId, newHash);
  return { ok: true };
}

export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  return changePasswordWith(
    {
      findUser: (id) =>
        prisma.user.findUnique({ where: { id }, select: { passwordHash: true } }),
      updatePassword: async (id, passwordHash) => {
        await prisma.user.update({
          where: { id },
          data: { passwordHash, mustChangePassword: false },
        });
      },
    },
    userId,
    currentPassword,
    newPassword,
  );
}
