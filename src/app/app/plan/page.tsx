import { redirect } from "next/navigation";
import { todayInSaoPaulo } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { requirePatient } from "@/server/auth/guards";
import { getPatientDay } from "@/server/services/patient-day";
import { logoutAction } from "../../(auth)/actions";

export default async function MyPlanPage() {
  const patient = await requirePatient();
  if (!patient) redirect("/login");

  const day = await getPatientDay(patient.id, todayInSaoPaulo());

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
        Prescrito pela sua nutri
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">
        Meu plano
      </h1>

      {!day.hasPlan ? (
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
              Metas do dia
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(
                [
                  [day.balance?.targets.kcal, "kcal"],
                  [day.balance?.targets.proteinG, "proteína"],
                  [day.balance?.targets.carbsG, "carbo"],
                  [day.balance?.targets.fatG, "gordura"],
                ] as const
              ).map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-xl font-semibold">{value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-caramel-200">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {day.slots.map((slot) => (
              <div
                key={slot.slotId}
                className="rounded-2xl border border-line-200 bg-cream-50 p-4"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-base font-semibold text-ink-900">
                    {slot.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    {slot.timeHint ? `${slot.timeHint} · ` : ""}
                    meta {slot.targets.kcal} kcal
                  </p>
                </div>
                {slot.baseItems.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {slot.baseItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-ink-900">
                          {item.label}{" "}
                          <span className="text-xs text-ink-300">{item.detail}</span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-500">
                          {item.macros.kcal} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-ink-300">
                    Sem itens fixos — use as opções do dia.
                  </p>
                )}
                <p className="mt-2 border-t border-line-200 pt-2 text-xs text-ink-500">
                  Dieta base: <strong>{slot.baseTotals.kcal} kcal</strong> ·{" "}
                  {slot.baseTotals.proteinG}P · {slot.baseTotals.carbsG}C ·{" "}
                  {slot.baseTotals.fatG}G
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <form action={logoutAction} className="mt-8 text-center">
        <button
          type="submit"
          className="text-sm text-ink-500 underline hover:text-brand-600"
        >
          Sair da conta
        </button>
      </form>
    </div>
  );
}
