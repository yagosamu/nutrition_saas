"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const ITEMS: {
  href: string;
  label: string;
  icon: IconName;
  exact: boolean;
  disabled?: boolean;
}[] = [
  { href: "/app", label: "Hoje", icon: "home", exact: true },
  { href: "/app/diary", label: "Diário", icon: "book", exact: false },
  { href: "/app/plan", label: "Meu plano", icon: "list", exact: false },
  { href: "#", label: "Progresso", icon: "chart", exact: false, disabled: true },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line-200 bg-cream-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-md px-2 pb-5 pt-2">
        {ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.label}
                title="Chega na Fase 5"
                className="flex flex-1 cursor-not-allowed flex-col items-center gap-0.5 py-1 text-[10px] text-ink-300 opacity-50"
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </span>
            );
          }
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] ${
                active ? "font-semibold text-brand-500" : "text-ink-500"
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
