import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = await prisma.ingredient.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      source: true,
      kcalPer100g: true,
      proteinGPer100g: true,
      carbsGPer100g: true,
      fatGPer100g: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return NextResponse.json({ items });
}
