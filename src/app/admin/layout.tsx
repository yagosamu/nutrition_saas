import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { logoutAction } from "../(auth)/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <span className="font-semibold text-zinc-900">Painel da equipe</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{session.user.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-zinc-500 underline hover:text-zinc-900"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
