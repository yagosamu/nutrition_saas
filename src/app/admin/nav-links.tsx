"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/patients", label: "Pacientes", exact: false },
  { href: "/admin/recipes", label: "Receitas", exact: false },
  { href: "/admin/ingredients", label: "Ingredientes", exact: false },
  { href: "/admin/materials", label: "Materiais", exact: false },
  { href: "/admin/ai-usage", label: "Consumo de IA", exact: false },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "rounded-lg bg-brand-100 px-3 py-2 text-sm font-semibold text-brand-600"
                : "rounded-lg px-3 py-2 text-sm text-ink-500 transition hover:bg-cream-200 hover:text-ink-900"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
