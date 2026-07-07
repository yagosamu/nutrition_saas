import { redirect } from "next/navigation";
import { formatDatePtBr, todayInSaoPaulo } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { auth } from "@/server/auth";
import { getPatientDay } from "@/server/services/patient-day";
import { DayNoteForm, TodayMealCard } from "./today-meal-card";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function BalanceBar({
  label,
  consumed,
  target,
}: {
  label: string;
  consumed: number;
  target: number;
}) {
  const pct = target > 0 ? (consumed / target) * 100 : 0;
  const over = pct > 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-caramel-200">
        <span>{label}</span>
        <span className={`font-medium ${over ? "text-danger-100" : "text-cream-100"}`}>
          {consumed} / {target} g
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-charcoal-700">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-danger-600" : "bg-caramel-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PATIENT") redirect("/login");

  const today = todayInSaoPaulo();
  const day = await getPatientDay(session.user.id, today);
  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <div>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
            {formatDatePtBr(today)}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold text-ink-900">
            {greeting()}, <span className="text-brand-500">{firstName}</span>.
          </h1>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-caramel-500 text-sm font-semibold text-charcoal-900">
          {firstName.slice(0, 2).toUpperCase()}
        </span>
      </header>

      {!day.hasPlan || !day.balance ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line-200 bg-cream-50 px-6 py-10 text-center">
          <Icon name="sparkles" size={24} className="mx-auto text-caramel-500" />
          <p className="mt-2 font-display text-base font-semibold text-ink-900">
            Seu plano está sendo preparado
          </p>
          <p className="mt-1 text-sm text-ink-500">
            A equipe já está montando suas refeições. Volte em breve!
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-3xl bg-charcoal-900 p-5 text-cream-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
              Saldo de hoje
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-tight">
              {day.balance.remaining.kcal}{" "}
              <span className="text-base font-normal text-caramel-200">
                kcal restantes de {day.balance.targets.kcal}
              </span>
            </p>
            <div className="mt-4 space-y-3">
              <BalanceBar
                label="Proteína"
                consumed={day.balance.consumed.proteinG}
                target={day.balance.targets.proteinG}
              />
              <BalanceBar
                label="Carboidrato"
                consumed={day.balance.consumed.carbsG}
                target={day.balance.targets.carbsG}
              />
              <BalanceBar
                label="Gordura"
                consumed={day.balance.consumed.fatG}
                target={day.balance.targets.fatG}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {day.slots.map((slot) => (
              <TodayMealCard
                key={slot.slotId}
                date={today}
                slot={{
                  slotId: slot.slotId,
                  name: slot.name,
                  timeHint: slot.timeHint,
                  targetKcal: slot.targets.kcal,
                  baseKcal: slot.baseTotals.kcal,
                  log: slot.log
                    ? {
                        status: slot.log.status,
                        type: slot.log.type,
                        consumedKcal: slot.log.consumed.kcal,
                        freeDescription: slot.log.freeDescription,
                      }
                    : null,
                }}
              />
            ))}
          </div>

          <div className="mt-4">
            <DayNoteForm date={today} initial={day.dayNote} />
          </div>
        </>
      )}
    </div>
  );
}
