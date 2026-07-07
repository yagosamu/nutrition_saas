import { auth } from "@/server/auth";

export async function requireAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return { id: session.user.id };
}

export async function requirePatient(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "PATIENT") return null;
  return { id: session.user.id };
}
