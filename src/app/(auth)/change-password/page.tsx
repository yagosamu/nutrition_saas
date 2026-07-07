import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream-100 px-4">
      <div className="mb-8 text-center">
        <p className="font-display text-lg font-semibold tracking-[0.18em] text-ink-900">
          MANUELA GIGLIO
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-caramel-500">
          Nutricionista
        </p>
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-line-200 bg-cream-50 p-8">
        <h1 className="mb-2 text-center font-display text-xl font-semibold text-ink-900">
          Alterar senha
        </h1>
        <p className="mb-6 text-center text-sm text-ink-500">
          {session.user.mustChangePassword
            ? "Por segurança, defina uma nova senha antes de continuar."
            : "Defina sua nova senha."}
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
