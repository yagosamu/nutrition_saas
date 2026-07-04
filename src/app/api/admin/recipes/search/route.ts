import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = await prisma.recipe.findMany({
    where: { status: "APPROVED", name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      servings: true,
      kcalPerServing: true,
      proteinGPerServing: true,
      carbsGPerServing: true,
      fatGPerServing: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return NextResponse.json({ items });
}
