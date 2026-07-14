import { notFound } from "next/navigation";
import { formatDatePtBr, todayInSaoPaulo } from "@/lib/dates";
import { prisma } from "@/server/db";
import { PatientTabs } from "../patient-tabs";
import { AssessmentForm, DeleteAssessmentButton } from "./assessment-form";

function fmt(n: number | null): string {
  return n != null ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";
}

export default async function PatientAssessmentsPage({
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

  const assessments = await prisma.assessment.findMany({
    where: { patientId: id },
    orderBy: { date: "desc" },
    include: { recordedBy: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        {patient.name}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{patient.email}</p>

      <PatientTabs patientId={patient.id} active="assessments" />

      <div className="mt-6">
        <AssessmentForm patientId={patient.id} today={todayInSaoPaulo()} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-wider text-ink-300">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Peso (kg)</th>
              <th className="px-4 py-3 font-medium">% GC</th>
              <th className="px-4 py-3 font-medium">Cintura (cm)</th>
              <th className="px-4 py-3 font-medium">Observações</th>
              <th className="px-4 py-3 font-medium">Registrado por</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-500">
                  Nenhuma avaliação ainda — registre a primeira.
                </td>
              </tr>
            )}
            {assessments.map((a) => (
              <tr
                key={a.id}
                className="border-b border-line-200 last:border-0 hover:bg-cream-100"
              >
                <td className="px-4 py-2.5 font-medium text-ink-900">
                  {formatDatePtBr(a.date.toISOString().slice(0, 10))}
                </td>
                <td className="px-4 py-2.5">{fmt(a.weightKg)}</td>
                <td className="px-4 py-2.5">{fmt(a.bodyFatPct)}</td>
                <td className="px-4 py-2.5">{fmt(a.waistCm)}</td>
                <td className="max-w-56 truncate px-4 py-2.5 text-ink-500">
                  {a.notes ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-ink-500">
                  {a.source === "PATIENT" ? (
                    <span className="rounded-full bg-caramel-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-900">
                      paciente
                    </span>
                  ) : (
                    (a.recordedBy?.name ?? "Equipe")
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <DeleteAssessmentButton id={a.id} patientId={patient.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
