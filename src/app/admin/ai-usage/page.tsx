import { prisma } from "@/server/db";

const TYPE_LABELS: Record<string, string> = {
  SUGGEST: "Sugestões",
  GENERATE: "Geração de receita",
  EVALUATE_EXTERNAL: "Receita externa",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Na fila", className: "bg-cream-200 text-ink-500" },
  RUNNING: { label: "Processando", className: "bg-caramel-200 text-ink-900" },
  COMPLETED: { label: "Concluído", className: "bg-success-100 text-success-600" },
  FAILED: { label: "Falhou", className: "bg-danger-100 text-danger-600" },
};

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toFixed(4)}`;
}

export default async function AiUsagePage() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const [jobsToday, monthAgg, jobs] = await Promise.all([
    prisma.aiJob.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.aiJob.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.aiJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { patient: { select: { name: true } } },
    }),
  ]);

  const monthCost = monthAgg._sum.costUsd ? Number(monthAgg._sum.costUsd) : 0;
  const monthTokens =
    (monthAgg._sum.inputTokens ?? 0) + (monthAgg._sum.outputTokens ?? 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Consumo de IA
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Todos os jobs de IA com tokens e custo estimado
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {(
          [
            [String(jobsToday), "jobs hoje"],
            [`$${monthCost.toFixed(2)}`, "custo no mês"],
            [monthTokens.toLocaleString("pt-BR"), "tokens no mês"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="rounded-xl border border-line-200 bg-cream-50 p-4">
            <p className="font-display text-2xl font-semibold text-ink-900">{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-300">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-wider text-ink-300">
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Tokens in/out</th>
              <th className="px-4 py-3 text-right font-medium">Custo</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                  Nenhum job de IA ainda.
                </td>
              </tr>
            )}
            {jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.PENDING;
              return (
                <tr key={job.id} className="border-b border-line-200 last:border-0">
                  <td className="px-4 py-2.5 text-ink-500">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(job.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink-900">
                    {job.patient.name}
                  </td>
                  <td className="px-4 py-2.5 text-ink-500">
                    {TYPE_LABELS[job.type] ?? job.type}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-500">
                    {job.inputTokens != null
                      ? `${job.inputTokens.toLocaleString("pt-BR")} / ${(job.outputTokens ?? 0).toLocaleString("pt-BR")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display font-semibold">
                    {formatUsd(job.costUsd == null ? null : Number(job.costUsd))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-300">
        Custo estimado a partir das tabelas de preço da Anthropic (config em
        src/server/ai/config.ts).
      </p>
    </div>
  );
}
