import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDatePtBr, todayInSaoPaulo } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { requirePatient } from "@/server/auth/guards";
import { getPatientDay } from "@/server/services/patient-day";
import { MealActions } from "./meal-actions";

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const patient = await requirePatient();
  if (!patient) redirect("/login");

  const { slotId } = await params;
  const today = todayInSaoPaulo();
  const day = await getPatientDay(patient.id, today);
  const slot = day.slots.find((s) => s.slotId === slotId);
  if (!slot) notFound();

  return (
    <div>
      <header className="flex items-center gap-3">
        <Link
          href="/app"
          aria-label="Voltar para hoje"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line-200 bg-cream-50 text-ink-500 hover:text-brand-600"
        >
          <Icon name="arrowLeft" size={18} />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
            {formatDatePtBr(today)}
          </p>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {slot.name}
          </h1>
        </div>
      </header>

      <div className="mt-4 flex gap-4 rounded-2xl bg-charcoal-900 px-5 py-4 text-cream-100">
        {(
          [
            [slot.targets.kcal, "kcal"],
            [`${slot.targets.proteinG}g`, "proteína"],
            [`${slot.targets.carbsG}g`, "carbo"],
            [`${slot.targets.fatG}g`, "gordura"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="flex-1">
            <p className="font-display text-lg font-semibold">{value}</p>
            <p className="text-[9px] uppercase tracking-wider text-caramel-200">
              meta · {label}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-line-200 bg-cream-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
          Sua dieta base
        </p>
        {slot.baseItems.length > 0 ? (
          <>
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
            <p className="mt-2 border-t border-line-200 pt-2 text-xs text-ink-500">
              Total: <strong>{slot.baseTotals.kcal} kcal</strong> ·{" "}
              {slot.baseTotals.proteinG}P · {slot.baseTotals.carbsG}C ·{" "}
              {slot.baseTotals.fatG}G
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-300">
            Sem itens fixos para esta refeição — use o registro livre.
          </p>
        )}
      </section>

      <div className="mt-4">
        <MealActions
          slotId={slot.slotId}
          date={today}
          baseKcal={slot.baseTotals.kcal}
          log={
            slot.log
              ? {
                  status: slot.log.status,
                  type: slot.log.type,
                  freeDescription: slot.log.freeDescription,
                  notes: slot.log.notes,
                  consumedKcal: slot.log.consumed.kcal,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
