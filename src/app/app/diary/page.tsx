import { redirect } from "next/navigation";
import { formatDatePtBr, todayInSaoPaulo } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { requirePatient } from "@/server/auth/guards";
import { getPatientDiary } from "@/server/services/patient-diary";

function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoje";
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Ontem";
  return formatDatePtBr(date);
}

export default async function DiaryPage() {
  const patient = await requirePatient();
  if (!patient) redirect("/login");

  const today = todayInSaoPaulo();
  const diary = await getPatientDiary(patient.id);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
        Últimos 14 dias
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">
        Diário
      </h1>

      {diary.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line-200 bg-cream-50 px-6 py-10 text-center">
          <Icon name="book" size={24} className="mx-auto text-caramel-500" />
          <p className="mt-2 font-display text-base font-semibold text-ink-900">
            Nenhum registro ainda
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Registre suas refeições na tela Hoje e elas aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {diary.map((day) => (
            <section key={day.date}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-base font-semibold text-ink-900">
                  {dayLabel(day.date, today)}
                </h2>
                {day.totalKcal > 0 && (
                  <span className="text-xs text-ink-500">
                    {day.totalKcal} kcal no dia
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {day.logs.map((log, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-line-200 bg-cream-50 px-4 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-ink-900">
                        {log.slotName}
                        {log.type === "FREE_ENTRY" && log.freeDescription && (
                          <span className="text-ink-500"> · {log.freeDescription}</span>
                        )}
                      </p>
                      {log.status === "COMPLETED" ? (
                        <span className="shrink-0 text-xs text-ink-500">
                          {log.consumed.kcal} kcal
                          {log.type === "FREE_ENTRY" && (
                            <span className="ml-1 rounded-full bg-caramel-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ink-900">
                              livre
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-300">
                          pulada
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="mt-1 text-xs text-ink-500">“{log.notes}”</p>
                    )}
                  </div>
                ))}
                {day.dayNote && (
                  <p className="rounded-2xl bg-cream-200 px-4 py-2.5 text-sm text-ink-500">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                      Nota do dia ·{" "}
                    </span>
                    {day.dayNote}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
