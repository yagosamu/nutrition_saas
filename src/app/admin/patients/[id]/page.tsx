import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { PatientEditForm } from "../patient-edit-form";
import { PatientTabs } from "./patient-tabs";

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

      <PatientTabs patientId={patient.id} active="" />

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
