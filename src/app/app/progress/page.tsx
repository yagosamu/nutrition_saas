import { redirect } from "next/navigation";
import { formatDatePtBr } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { requirePatient } from "@/server/auth/guards";
import { getPatientProgress } from "@/server/services/patient-progress";
import { WeightChart } from "./weight-chart";
import { WeightForm } from "./weight-form";

function fmtKg(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export default async function ProgressPage() {
  const patient = await requirePatient();
  if (!patient) redirect("/login");

  const progress = await getPatientProgress(patient.id);
  const { currentWeightKg, delta30dKg, adherence7, adherence30 } = progress;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
        Sua evolução
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">
        Progresso
      </h1>

      <div className="mt-5 rounded-3xl bg-charcoal-900 p-5 text-cream-100">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
              Peso atual
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {currentWeightKg != null ? fmtKg(currentWeightKg) : "—"}
              {currentWeightKg != null && (
                <span className="text-sm font-normal text-caramel-200"> kg</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
              Δ 30 dias
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {delta30dKg != null ? (
                <>
                  {delta30dKg > 0 ? "+" : ""}
                  {fmtKg(delta30dKg)}
                  <span className="text-sm font-normal text-caramel-200"> kg</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-caramel-200">
              Aderência 7d
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {adherence7.pct}
              <span className="text-sm font-normal text-caramel-200">%</span>
            </p>
            <p className="text-[10px] text-caramel-200">
              {adherence30.pct}% em 30 dias
            </p>
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-3xl border border-line-200 bg-cream-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            Evolução do peso
          </p>
          <span className="flex items-center gap-2 text-[10px] text-ink-300">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-caramel-500" /> você
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-500" /> equipe
            </span>
          </span>
        </div>
        <div className="mt-2">
          <WeightChart points={progress.weights} />
        </div>
      </section>

      <div className="mt-4">
        <WeightForm />
      </div>

      <section className="mt-6">
        <h2 className="font-display text-base font-semibold text-ink-900">
          Histórico
        </h2>
        {progress.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Seus registros de peso e as avaliações da equipe aparecem aqui.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {progress.timeline.map((entry, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-line-200 bg-cream-50 px-4 py-2.5"
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
      </section>
    </div>
  );
}
