import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { requirePatient } from "@/server/auth/guards";
import { getPatientMaterials } from "@/server/services/materials";

function domainOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default async function PatientMaterialsPage() {
  const patient = await requirePatient();
  if (!patient) redirect("/login");

  const materials = await getPatientMaterials(patient.id);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-caramel-500">
        Da sua nutri
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">
        Materiais
      </h1>

      {materials.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line-200 bg-cream-50 px-6 py-10 text-center">
          <Icon name="folder" size={24} className="mx-auto text-caramel-500" />
          <p className="mt-2 font-display text-base font-semibold text-ink-900">
            Nada por aqui ainda
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Quando sua nutri compartilhar guias e materiais, eles aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {materials.map((m) => (
            <a
              key={m.id}
              href={m.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-line-200 bg-cream-50 px-4 py-3.5 transition hover:border-brand-500"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-caramel-200 text-ink-900">
                <Icon name="link" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {m.title}
                </span>
                {domainOf(m.url) && (
                  <span className="block truncate text-xs text-ink-300">
                    {domainOf(m.url)}
                  </span>
                )}
              </span>
              <Icon name="arrowLeft" size={16} className="shrink-0 rotate-180 text-ink-300" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
