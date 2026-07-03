import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { changed } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-900">
          Entrar
        </h1>
        <LoginForm passwordChanged={changed === "1"} />
      </div>
    </main>
  );
}
