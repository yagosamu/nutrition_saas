import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { logoutAction } from "../(auth)/actions";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PATIENT") redirect("/");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <span className="font-semibold text-emerald-800">Meu plano</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-zinc-500 underline hover:text-zinc-900"
          >
            Sair
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
