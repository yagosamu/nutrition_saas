import Link from "next/link";
import { Icon } from "@/components/icons";
import { getAdminDashboard } from "@/server/services/admin-dashboard";

function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </>
  );
  const base = "rounded-xl border border-line-200 bg-cream-50 p-5";
  return href ? (
    <Link href={href} className={`${base} block transition hover:border-brand-500`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export default async function AdminDashboardPage() {
  const dash = await getAdminDashboard();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Visão geral
      </h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pacientes ativos"
          value={String(dash.activePatients)}
          href="/admin/patients"
        />
        <StatCard label="Registros hoje" value={String(dash.logsToday)} />
        <StatCard
          label="Fila de curadoria"
          value={String(dash.pendingCuration)}
          href="/admin/recipes?status=PENDING_REVIEW"
          hint={dash.pendingCuration > 0 ? "receitas aguardando revisão" : "nada pendente"}
        />
        <StatCard
          label="Custo de IA no mês"
          value={`$${dash.aiCostMonthUsd.toFixed(2)}`}
          href="/admin/ai-usage"
        />
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
          <Icon name="alert" size={18} className="text-brand-500" />
          Sem registro há 3+ dias
        </h2>
        {dash.inactiveAlerts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Todos os pacientes ativos registraram recentemente ✓
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {dash.inactiveAlerts.map((alert) => (
              <Link
                key={alert.patientId}
                href={`/admin/patients/${alert.patientId}/diary`}
                className="flex items-center justify-between rounded-xl border border-line-200 bg-cream-50 px-4 py-3 transition hover:border-brand-500"
              >
                <span className="text-sm font-medium text-ink-900">{alert.name}</span>
                <span className="text-xs text-ink-500">
                  {alert.daysSince == null
                    ? "nunca registrou"
                    : `há ${alert.daysSince} dias sem registro`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          Aderência (7 dias)
        </h2>
        {dash.adherenceByPatient.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Nenhum paciente ativo ainda.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {dash.adherenceByPatient.map((row) => (
              <Link
                key={row.patientId}
                href={`/admin/patients/${row.patientId}/evolution`}
                className="flex items-center gap-4 rounded-xl border border-line-200 bg-cream-50 px-4 py-3 transition hover:border-brand-500"
              >
                <span className="w-44 shrink-0 truncate text-sm font-medium text-ink-900">
                  {row.name}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200">
                  <span
                    className={`block h-full rounded-full ${
                      row.adherence.pct < 50 ? "bg-brand-500" : "bg-caramel-500"
                    }`}
                    style={{ width: `${row.adherence.pct}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-sm text-ink-500">
                  {row.adherence.pct}%
                  <span className="ml-1 text-xs text-ink-300">
                    ({row.adherence.logged}/{row.adherence.expected})
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
