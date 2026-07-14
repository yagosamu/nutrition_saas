import Link from "next/link";

const TABS = [
  { slug: "", label: "Dados" },
  { slug: "plan", label: "Plano alimentar" },
  { slug: "assessments", label: "Avaliações" },
  { slug: "diary", label: "Diário" },
  { slug: "materials", label: "Materiais" },
  { slug: "evolution", label: "Evolução" },
] as const;

export type PatientTabSlug = (typeof TABS)[number]["slug"];

export function PatientTabs({
  patientId,
  active,
}: {
  patientId: string;
  active: PatientTabSlug;
}) {
  return (
    <div className="mt-6 flex gap-1 border-b border-line-200">
      {TABS.map((tab) =>
        tab.slug === active ? (
          <span
            key={tab.slug}
            className="border-b-2 border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.slug}
            href={`/admin/patients/${patientId}${tab.slug ? `/${tab.slug}` : ""}`}
            className="px-4 py-2 text-sm text-ink-500 hover:text-brand-600"
          >
            {tab.label}
          </Link>
        ),
      )}
    </div>
  );
}
