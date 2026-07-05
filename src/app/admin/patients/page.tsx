import Link from "next/link";
import { prisma } from "@/server/db";

export default async function PatientsPage() {
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT" },
    orderBy: { name: "asc" },
    include: {
      patientProfile: { select: { dailyAiLimit: true } },
      mealPlans: { where: { active: true }, select: { id: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {patients.length} pacientes cadastrados
          </p>
        </div>
        <Link
          href="/admin/patients/new"
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-brand-600"
        >
          Novo paciente
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-wider text-ink-300">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Plano ativo</th>
              <th className="px-4 py-3 text-right font-medium">Limite IA/dia</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                  Nenhum paciente ainda — cadastre o primeiro.
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr
                key={p.id}
                className="border-b border-line-200 last:border-0 hover:bg-cream-100"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/patients/${p.id}`}
                    className="block font-medium text-ink-900 hover:text-brand-600"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ink-500">{p.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      p.active
                        ? "rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600"
                        : "rounded-full bg-cream-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-300"
                    }
                  >
                    {p.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-500">
                  {p.mealPlans.length > 0 ? "Sim" : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-display font-semibold">
                  {p.patientProfile?.dailyAiLimit ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
