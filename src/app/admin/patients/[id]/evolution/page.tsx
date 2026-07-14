import { notFound } from "next/navigation";
import { formatDatePtBr } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { prisma } from "@/server/db";
import { getPatientProgress } from "@/server/services/patient-progress";
import { WeightChart } from "@/app/app/progress/weight-chart";
import { PatientTabs } from "../patient-tabs";

function fmtKg(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export default async function PatientEvolutionPage({
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

  const progress = await getPatientProgress(patient.id);
  const { currentWeightKg, delta30dKg, adherence7, adherence30 } = progress;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        {patient.name}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{patient.email}</p>

      <PatientTabs patientId={patient.id} active="evolution" />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="rounded-xl bg-charcoal-900 p-5 text-cream-100">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
                  Peso atual
                </p>
                <p className="mt-1 font-display text-xl font-semibold tracking-tight">
                  {currentWeightKg != null ? `${fmtKg(currentWeightKg)} kg` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
                  Δ 30 dias
                </p>
                <p className="mt-1 font-display text-xl font-semibold tracking-tight">
                  {delta30dKg != null
                    ? `${delta30dKg > 0 ? "+" : ""}${fmtKg(delta30dKg)} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
                  Aderência 7d
                </p>
                <p className="mt-1 font-display text-xl font-semibold tracking-tight">
                  {adherence7.pct}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
                  Aderência 30d
                </p>
                <p className="mt-1 font-display text-xl font-semibold tracking-tight">
                  {adherence30.pct}%
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line-200 bg-cream-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                Evolução do peso
              </p>
              <span className="flex items-center gap-2 text-[10px] text-ink-300">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-caramel-500" /> paciente
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-500" /> equipe
                </span>
              </span>
            </div>
            <div className="mt-2">
              <WeightChart points={progress.weights} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-ink-900">
            Histórico
          </h2>
          {progress.timeline.length === 0 ? (
            <p className="mt-2 text-sm text-ink-500">
              Registros de peso e avaliações aparecem aqui.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {progress.timeline.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-line-200 bg-cream-50 px-4 py-2.5"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      entry.kind === "TEAM_ASSESSMENT"
                        ? "bg-brand-500/10 text-brand-600"
                        : "bg-caramel-200 text-ink-900"
                    }`}
                  >
                    <Icon
                      name={entry.kind === "TEAM_ASSESSMENT" ? "edit" : "chart"}
                      size={12}
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-ink-900">
                        {formatDatePtBr(entry.date)}
                      </p>
                      {entry.kind === "TEAM_ASSESSMENT" && (
                        <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-600">
                          equipe
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-500">{entry.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
