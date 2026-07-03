import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          Alterar senha
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          {session.user.mustChangePassword
            ? "Por segurança, defina uma nova senha antes de continuar."
            : "Defina sua nova senha."}
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
