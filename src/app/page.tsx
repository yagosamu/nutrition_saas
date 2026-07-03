import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  redirect(session.user.role === "ADMIN" ? "/admin" : "/app");
}
