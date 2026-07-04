import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { logoutAction } from "../(auth)/actions";
import { NavLinks } from "./nav-links";

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
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line-200 bg-cream-50">
        <div className="px-6 pb-5 pt-7">
          <p className="font-display text-sm font-semibold tracking-[0.18em] text-ink-900">
            MANUELA GIGLIO
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-caramel-500">
            Nutricionista
          </p>
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-line-200 px-6 py-4">
          <p className="truncate text-sm font-medium text-ink-900">
            {session.user.name}
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 text-xs text-ink-500 underline hover:text-brand-600"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-cream-100 px-10 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
