"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { useT } from "./LangProvider";

interface NavItem {
  href: string;
  labelKey: string;
  roles: UserRole[];
  soon?: boolean;
}
interface NavGroup {
  sec: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    sec: "sec.content",
    items: [
      { href: "/content", labelKey: "nav.content", roles: ["admin", "market_manager"] },
      { href: "/translate", labelKey: "nav.translate", roles: ["admin", "market_manager"] },
      { href: "/guidelines", labelKey: "nav.guidelines", roles: ["admin", "market_manager"] },
    ],
  },
  {
    sec: "sec.seo",
    items: [
      { href: "/keywords", labelKey: "nav.keywords", roles: ["admin", "market_manager"], soon: true },
      { href: "/audit", labelKey: "nav.audit", roles: ["admin", "market_manager"] },
      { href: "/backlinks", labelKey: "nav.backlinks", roles: ["admin", "market_manager"], soon: true },
    ],
  },
  {
    sec: "sec.advanced",
    items: [
      { href: "/architecture", labelKey: "nav.architecture", roles: ["admin", "market_manager"], soon: true },
      { href: "/topical", labelKey: "nav.topical", roles: ["admin", "market_manager"], soon: true },
      { href: "/competitor", labelKey: "nav.competitor", roles: ["admin", "market_manager"], soon: true },
      { href: "/search-console", labelKey: "nav.gsc", roles: ["admin", "market_manager"], soon: true },
    ],
  },
  {
    sec: "sec.track",
    items: [
      { href: "/execution", labelKey: "nav.execution", roles: ["admin", "market_manager"] },
      { href: "/roadmap", labelKey: "nav.roadmap", roles: ["admin", "market_manager"] },
      { href: "/dashboard", labelKey: "nav.dashboard", roles: ["admin", "market_manager", "viewer"] },
    ],
  },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const t = useT();

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => n.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="w-full lg:w-60 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border bg-white lg:min-h-[calc(100vh-57px)]">
      <nav className="flex lg:block overflow-x-auto lg:overflow-visible py-1 lg:py-3">
        {groups.map((g) => (
          <div key={g.sec} className="contents lg:block">
            <div className="hidden lg:block px-5 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-body/60">
              {t(g.sec)}
            </div>
            {g.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "whitespace-nowrap flex items-center gap-2 px-4 lg:px-5 py-3 lg:py-2 text-sm transition-colors",
                    "border-b-2 lg:border-b-0 lg:border-l-2",
                    active
                      ? "border-bosch-red text-ink lg:bg-surface-muted font-medium"
                      : "border-transparent text-ink-body hover:bg-surface-muted hover:text-ink",
                  ].join(" ")}
                >
                  {t(item.labelKey)}
                  {item.soon && (
                    <span className="rounded-bosch bg-surface-muted border border-surface-border px-1.5 py-0.5 text-[10px] text-ink-body">
                      {t("badge.soon")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
