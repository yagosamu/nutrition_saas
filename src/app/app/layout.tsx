import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { BottomNav } from "./bottom-nav";

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
    <div className="min-h-dvh bg-cream-100">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
