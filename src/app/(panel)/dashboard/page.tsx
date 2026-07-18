import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import type { Market, ContentTranslation, Content } from "@/lib/types";

export const dynamic = "force-dynamic";

interface MarketRow {
  market: Market;
  total: number;
  draft: number;
  translated: number;
  approved: number;
  pct: number;
}

function Bar({ value }: { value: number }) {
  const color = value >= 100 ? "bg-bosch-green" : value >= 50 ? "bg-bosch-blue" : "bg-bosch-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-bosch bg-surface-border overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-ink-body w-9 text-right">{value}%</span>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: markets = [] } = await supabase.from("markets").select("*").in("code", ["TR", "EN", "DE"]).order("sort_order");
  const { data: contents = [] } = await supabase.from("contents").select("id");
  const { data: translations = [] } = await supabase.from("content_translations").select("*");

  const ms = markets as Market[];
  const tx = translations as ContentTranslation[];
  const totalContents = (contents as Pick<Content, "id">[]).length;

  function rowFor(m: Market): MarketRow {
    if (m.is_source) {
      return { market: m, total: totalContents, draft: 0, translated: 0, approved: totalContents, pct: 100 };
    }
    const mt = tx.filter((t) => t.market_id === m.id);
    const total = mt.length;
    const draft = mt.filter((t) => t.status === "draft").length;
    const translated = mt.filter((t) => t.status === "translated").length;
    const approved = mt.filter((t) => t.status === "approved").length;
    const pct = total ? Math.round((approved / total) * 100) : 0;
    return { market: m, total, draft, translated, approved, pct };
  }

  const rows = ms.map(rowFor);
  const t = getT();

  return (
    <div>
      <PageHeader title={t("db.title")} description={t("db.desc")} />

      {/* Üst özet: pazar başına onaylanmış içerik % */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {rows.map((r) => {
          const value = r.pct;
          const color = value >= 100 ? "text-bosch-green" : value >= 50 ? "text-bosch-blue" : "text-bosch-red";
          const bar = value >= 100 ? "bg-bosch-green" : value >= 50 ? "bg-bosch-blue" : "bg-bosch-red";
          return (
            <div key={r.market.id} className="bg-surface-muted border border-surface-border rounded-bosch p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">
                  {r.market.code} · {r.market.name}
                </span>
                {r.market.is_source && (
                  <span className="text-xs rounded-bosch bg-bosch-red px-1.5 py-0.5 text-white">{t("db.source")}</span>
                )}
              </div>
              <div className={`text-3xl font-semibold ${color}`}>{value}%</div>
              <div className="mt-2 h-1.5 rounded-bosch bg-surface-border overflow-hidden">
                <div className={`h-full ${bar}`} style={{ width: `${value}%` }} />
              </div>
              {!r.market.is_source && (
                <div className="mt-2 text-xs text-ink-body">
                  {r.approved} {t("status.approved").toLowerCase()} · {r.translated} {t("status.translated").toLowerCase()} · {r.draft} {t("status.draft").toLowerCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* İçerik çeviri hattı */}
      <h2 className="text-sm font-semibold text-ink mb-3">{t("db.pipeline")}</h2>
      <div className="border border-surface-border rounded-bosch overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-ink-body">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">{t("db.colMarket")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("db.colTotal")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("status.draft")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("status.translated")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("status.approved")}</th>
              <th className="text-left font-medium px-4 py-2.5">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.market.id} className="border-t border-surface-border">
                <td className="px-4 py-3 font-medium text-ink">
                  {r.market.code}
                  {r.market.is_source && <span className="ml-1 text-xs text-ink-body">({t("db.source")})</span>}
                </td>
                <td className="px-4 py-3 text-ink-body">{r.total}</td>
                <td className="px-4 py-3 text-ink-body">{r.market.is_source ? "—" : r.draft}</td>
                <td className="px-4 py-3 text-bosch-blue">{r.market.is_source ? "—" : r.translated}</td>
                <td className="px-4 py-3 text-bosch-green">{r.approved}</td>
                <td className="px-4 py-3">
                  <Bar value={r.pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-body">{t("db.footnote")}</p>
    </div>
  );
}
