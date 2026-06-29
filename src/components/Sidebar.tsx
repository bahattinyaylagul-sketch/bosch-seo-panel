"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/content", label: "İçerik kütüphanesi", roles: ["admin", "market_manager"] },
  { href: "/guidelines", label: "Guideline", roles: ["admin", "market_manager"] },
  { href: "/execution", label: "İş takibi", roles: ["admin", "market_manager"] },
  { href: "/roadmap", label: "Roadmap", roles: ["admin", "market_manager"] },
  { href: "/dashboard", label: "Global dashboard", roles: ["admin", "market_manager", "viewer"] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="w-60 shrink-0 border-r border-surface-border bg-white min-h-[calc(100vh-57px)]">
      <nav className="py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2 px-5 py-2.5 text-sm border-l-2 transition-colors",
                active
                  ? "border-bosch-red text-ink bg-surface-muted font-medium"
                  : "border-transparent text-ink-body hover:bg-surface-muted hover:text-ink",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
