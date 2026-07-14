import { notFound } from "next/navigation";
import { formatDatePtBr, todayInSaoPaulo } from "@/lib/dates";
import { prisma } from "@/server/db";
import { getPatientDiary } from "@/server/services/patient-diary";
import { PatientTabs } from "../patient-tabs";

function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoje";
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Ontem";
  return formatDatePtBr(date);
}

export default async function PatientDiaryAdminPage({
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

  const today = todayInSaoPaulo();
  const diary = await getPatientDiary(patient.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        {patient.name}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{patient.email}</p>

      <PatientTabs patientId={patient.id} active="diary" />

      <p className="mt-6 text-xs text-ink-300">
        Visão do diário do paciente (últimos 14 dias) — somente leitura.
      </p>

      {diary.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line-200 bg-cream-50 px-6 py-10 text-center text-sm text-ink-500">
          Nenhum registro no período.
        </div>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {diary.map((day) => (
            <section
              key={day.date}
              className="rounded-xl border border-line-200 bg-cream-50 p-4"
            >
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
              <div className="mt-2 space-y-1.5">
                {day.logs.map((log, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-line-200 bg-cream-100 px-3 py-2"
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
                  <p className="rounded-lg bg-cream-200 px-3 py-2 text-sm text-ink-500">
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
