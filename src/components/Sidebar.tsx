"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { useT } from "./LangProvider";

interface NavItem {
  href: string;
  labelKey: string;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/content", labelKey: "nav.content", roles: ["admin", "market_manager"] },
  { href: "/guidelines", labelKey: "nav.guidelines", roles: ["admin", "market_manager"] },
  { href: "/execution", labelKey: "nav.execution", roles: ["admin", "market_manager"] },
  { href: "/roadmap", labelKey: "nav.roadmap", roles: ["admin", "market_manager"] },
  { href: "/dashboard", labelKey: "nav.dashboard", roles: ["admin", "market_manager", "viewer"] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const t = useT();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="w-full lg:w-60 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border bg-white lg:min-h-[calc(100vh-57px)]">
      <nav className="flex lg:flex-col overflow-x-auto lg:overflow-visible py-1 lg:py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "whitespace-nowrap flex items-center gap-2 px-4 lg:px-5 py-3 lg:py-2.5 text-sm transition-colors",
                "border-b-2 lg:border-b-0 lg:border-l-2",
                active
                  ? "border-bosch-red text-ink lg:bg-surface-muted font-medium"
                  : "border-transparent text-ink-body hover:bg-surface-muted hover:text-ink",
              ].join(" ")}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
