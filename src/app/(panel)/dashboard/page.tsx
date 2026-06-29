import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import type {
  Market,
  ContentTranslation,
  Execution,
  ExecutionType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const EXEC_TYPES: ExecutionType[] = ["audit", "schema", "redirect", "geo", "optimization"];

function pct(done: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

function CellBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-ink-body">—</span>;
  const color = value >= 100 ? "bg-bosch-green" : value >= 50 ? "bg-bosch-blue" : "bg-bosch-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-bosch bg-surface-border overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-ink-body w-9 text-right">{value}%</span>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: markets = [] } = await supabase.from("markets").select("*").order("sort_order");
  const { data: translations = [] } = await supabase.from("content_translations").select("*");
  const { data: executions = [] } = await supabase.from("executions").select("*");

  const ms = markets as Market[];
  const tx = translations as ContentTranslation[];
  const ex = executions as Execution[];

  // Pazar başına genel ilerleme + içerik ilerlemesi
  function marketOverall(m: Market): number {
    if (m.is_source) return 100;
    const mt = tx.filter((t) => t.market_id === m.id);
    const me = ex.filter((e) => e.market_id === m.id);
    const total = mt.length + me.length;
    if (total === 0) return 0;
    const done = mt.filter((t) => t.status === "approved").length + me.filter((e) => e.status === "done").length;
    return Math.round((done / total) * 100);
  }

  function contentPct(m: Market): number | null {
    if (m.is_source) return 100;
    const mt = tx.filter((t) => t.market_id === m.id);
    return pct(mt.filter((t) => t.status === "approved").length, mt.length);
  }

  function execPct(m: Market, type: ExecutionType): number | null {
    if (m.is_source) {
      const all = ex.filter((e) => e.market_id === m.id && e.type === type);
      return pct(all.filter((e) => e.status === "done").length, all.length);
    }
    const all = ex.filter((e) => e.market_id === m.id && e.type === type);
    return pct(all.filter((e) => e.status === "done").length, all.length);
  }

  const t = getT();

  return (
    <div>
      <PageHeader title={t("db.title")} description={t("db.desc")} />

      {/* Üst özet: pazar başına genel % */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {ms.map((m) => {
          const value = marketOverall(m);
          const color = value >= 100 ? "text-bosch-green" : value >= 50 ? "text-bosch-blue" : "text-bosch-red";
          const bar = value >= 100 ? "bg-bosch-green" : value >= 50 ? "bg-bosch-blue" : "bg-bosch-red";
          return (
            <div key={m.id} className="bg-surface-muted border border-surface-border rounded-bosch p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">
                  {m.code} · {m.name}
                </span>
                {m.is_source && (
                  <span className="text-xs rounded-bosch bg-bosch-red px-1.5 py-0.5 text-white">{t("db.source")}</span>
                )}
              </div>
              <div className={`text-3xl font-semibold ${color}`}>{value}%</div>
              <div className="mt-2 h-1.5 rounded-bosch bg-surface-border overflow-hidden">
                <div className={`h-full ${bar}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pazar × iş tipi matrisi */}
      <h2 className="text-sm font-semibold text-ink mb-3">{t("db.matrix")}</h2>
      <div className="border border-surface-border rounded-bosch overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-ink-body">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">{t("db.colMarket")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("db.colContent")}</th>
              {EXEC_TYPES.map((ty) => (
                <th key={ty} className="text-left font-medium px-4 py-2.5">
                  {t(`execType.${ty}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ms.map((m) => (
              <tr key={m.id} className="border-t border-surface-border">
                <td className="px-4 py-3 font-medium text-ink">{m.code}</td>
                <td className="px-4 py-3">
                  <CellBar value={contentPct(m)} />
                </td>
                {EXEC_TYPES.map((ty) => (
                  <td key={ty} className="px-4 py-3">
                    <CellBar value={execPct(m, ty)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-body">{t("db.footnote")}</p>
    </div>
  );
}
