import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { PatientEditForm } from "../patient-edit-form";

const FUTURE_TABS = ["Avaliações", "Diário", "Materiais", "Evolução"];

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.user.findUnique({
    where: { id, role: "PATIENT" },
    include: { patientProfile: true },
  });
  if (!patient || !patient.patientProfile) notFound();

  const birthDate = patient.patientProfile.birthDate
    ? patient.patientProfile.birthDate.toISOString().slice(0, 10)
    : null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {patient.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{patient.email}</p>
        </div>
        {!patient.active && (
          <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold text-ink-300">
            Inativo
          </span>
        )}
      </div>

      <div className="mt-6 flex gap-1 border-b border-line-200">
        <span className="border-b-2 border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600">
          Dados
        </span>
        <Link
          href={`/admin/patients/${patient.id}/plan`}
          className="px-4 py-2 text-sm text-ink-500 hover:text-brand-600"
        >
          Plano alimentar
        </Link>
        {FUTURE_TABS.map((tab) => (
          <span
            key={tab}
            title="Chega na Fase 5"
            className="cursor-not-allowed px-4 py-2 text-sm text-ink-300"
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="mt-6">
        <PatientEditForm
          userId={patient.id}
          initial={{
            name: patient.name,
            birthDate,
            sex: patient.patientProfile.sex,
            teamNotes: patient.patientProfile.teamNotes,
            dailyAiLimit: patient.patientProfile.dailyAiLimit,
            active: patient.active,
          }}
        />
      </div>
    </div>
  );
}
