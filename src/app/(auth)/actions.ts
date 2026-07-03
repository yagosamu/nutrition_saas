"use server";

import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/server/auth";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/server/services/change-password";

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha inválidos" };
    }
    throw error; // NEXT_REDIRECT precisa propagar
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Sessão expirada. Entre novamente." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const result = await changePassword(
    session.user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) return { error: result.error };

  // JWT ainda carrega mustChangePassword=true; sair força novo login com token atualizado.
  await signOut({ redirectTo: "/login?changed=1" });
  return undefined;
}
