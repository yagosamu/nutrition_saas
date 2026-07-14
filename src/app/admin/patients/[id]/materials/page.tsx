import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { prisma } from "@/server/db";
import { getPatientMaterials } from "@/server/services/materials";
import { DeleteMaterialButton, MaterialForm } from "@/app/admin/materials/material-form";
import { PatientTabs } from "../patient-tabs";

export default async function PatientMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.user.findUnique({
    where: { id, role: "PATIENT" },
    select: { id: true, name: true, email: true },
  });
  if (!patient) notFound();

  const materials = await getPatientMaterials(patient.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        {patient.name}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{patient.email}</p>

      <PatientTabs patientId={patient.id} active="materials" />

      <div className="mt-6">
        <MaterialForm fixedPatientId={patient.id} />
      </div>

      <p className="mt-6 text-xs text-ink-300">
        Materiais visíveis para este paciente (globais + atribuídos a ele).
      </p>

      {materials.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line-200 bg-cream-50 px-6 py-10 text-center text-sm text-ink-500">
          Nenhum material visível para este paciente ainda.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-line-200 bg-cream-50 px-4 py-3"
            >
              <Icon name="link" size={16} className="shrink-0 text-caramel-500" />
              <a
                href={m.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-brand-600"
              >
                {m.title}
              </a>
              <span
                className={
                  m.isGlobal
                    ? "rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-500"
                    : "rounded-full bg-caramel-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-900"
                }
              >
                {m.isGlobal ? "global" : "específico"}
              </span>
              <DeleteMaterialButton id={m.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
