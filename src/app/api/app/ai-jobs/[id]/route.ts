import { NextResponse } from "next/server";
import { requirePatient } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const patient = await requirePatient();
  if (!patient) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const job = await prisma.aiJob.findFirst({
    where: { id, patientId: patient.id },
    select: { id: true, type: true, status: true, error: true, result: true },
  });
  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(job);
}
