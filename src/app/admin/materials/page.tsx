import Link from "next/link";
import { formatDatePtBr } from "@/lib/dates";
import { prisma } from "@/server/db";
import { DeleteMaterialButton, MaterialForm } from "./material-form";

export default async function AdminMaterialsPage() {
  const [materials, patients] = await Promise.all([
    prisma.material.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignments: {
          select: { patient: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "PATIENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">
          Materiais
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Links de apoio para os pacientes — globais ou específicos.
        </p>
      </div>

      <div className="mt-6">
        <MaterialForm patients={patients} />
      </div>
      <p className="mt-2 text-xs text-ink-300">
        Upload de PDF/imagem chega com o armazenamento de arquivos (R2).
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-wider text-ink-300">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Para quem</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-500">
                  Nenhum material ainda — adicione o primeiro link.
                </td>
              </tr>
            )}
            {materials.map((m) => (
              <tr
                key={m.id}
                className="border-b border-line-200 last:border-0 hover:bg-cream-100"
              >
                <td className="px-4 py-2.5">
                  <a
                    href={m.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink-900 hover:text-brand-600"
                  >
                    {m.title}
                  </a>
                </td>
                <td className="px-4 py-2.5">
                  {m.isGlobal ? (
                    <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-500">
                      todos os pacientes
                    </span>
                  ) : (
                    m.assignments.map((a) => (
                      <Link
                        key={a.patient.id}
                        href={`/admin/patients/${a.patient.id}/materials`}
                        className="rounded-full bg-caramel-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-900 hover:underline"
                      >
                        {a.patient.name}
                      </Link>
                    ))
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink-500">
                  {formatDatePtBr(m.createdAt.toISOString().slice(0, 10))}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <DeleteMaterialButton id={m.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
