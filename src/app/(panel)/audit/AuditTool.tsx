"use client";

import { useState, useTransition } from "react";
import { auditSite, type AuditData, type Check, type CheckStatus } from "./actions";
import { useT } from "@/components/LangProvider";

function scoreColor(pct: number | null) {
  if (pct === null) return { text: "text-ink-body", bar: "bg-surface-border" };
  if (pct >= 90) return { text: "text-bosch-green", bar: "bg-bosch-green" };
  if (pct >= 50) return { text: "text-bosch-blue", bar: "bg-bosch-blue" };
  return { text: "text-bosch-red", bar: "bg-bosch-red" };
}

function Dot({ status }: { status: CheckStatus }) {
  const c = status === "pass" ? "bg-bosch-green" : status === "warn" ? "bg-amber-500" : "bg-bosch-red";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${c}`} />;
}

function CheckList({ title, items }: { title: string; items: Check[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-ink mb-3">{title}</h2>
      <div className="border border-surface-border rounded-bosch overflow-hidden">
        {items.map((c, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-t border-surface-border first:border-t-0">
            <span className="mt-1.5">
              <Dot status={c.status} />
            </span>
            <div className="min-w-0">
              <div className="text-sm text-ink font-medium">{c.label}</div>
              <div className="text-xs text-ink-body break-words">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditTool() {
  const t = useT();
  const [url, setUrl] = useState("");
  const [res, setRes] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRes(null);
    start(async () => {
      try {
        const r = await auditSite(url);
        if (r.ok) setRes(r.data);
        else setError(r.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("au.error"));
      }
    });
  }

  const pc = res ? scoreColor(res.perfScore === null ? null : Math.round(res.perfScore * 100)) : null;
  const perfPct = res && res.perfScore !== null ? Math.round(res.perfScore * 100) : null;

  return (
    <div>
      <form onSubmit={run} className="flex flex-col sm:flex-row gap-3 mb-2">
        <div className="flex-1">
          <label className="block text-xs text-ink-body mb-1">{t("au.url")}</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("au.placeholder")}
            className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="self-stretch sm:self-end rounded-bosch bg-bosch-red px-5 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? t("au.running") : t("au.button")}
        </button>
      </form>
      <p className="text-xs text-ink-body mb-6">{t("au.hint")}</p>

      {error && (
        <p className="text-sm text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">{error}</p>
      )}

      {pending && !res && <div className="text-sm text-ink-body">{t("au.running")}</div>}

      {res && (
        <div>
          <p className="text-xs text-ink-body mb-4 break-all">{res.finalUrl}</p>

          {/* Performans skoru + Core Web Vitals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface-muted border border-surface-border rounded-bosch p-5">
              <div className="text-xs text-ink-body mb-1">Performans skoru</div>
              <div className={`text-5xl font-semibold ${pc!.text}`}>{perfPct ?? "—"}</div>
              <div className="mt-3 h-1.5 rounded-bosch bg-surface-border overflow-hidden">
                <div className={`h-full ${pc!.bar}`} style={{ width: `${perfPct ?? 0}%` }} />
              </div>
              <div className="mt-2 text-[11px] text-ink-body">Google Lighthouse · mobil</div>
            </div>

            <div className="lg:col-span-2 border border-surface-border rounded-bosch overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <tbody>
                  {res.metrics.map((m) => (
                    <tr key={m.key} className="border-t border-surface-border first:border-t-0">
                      <td className="px-4 py-2.5 text-ink-body w-40">{m.key}</td>
                      <td className="px-4 py-2.5 text-ink font-medium">{m.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hız iyileştirme fırsatları */}
          {res.opportunities.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-ink mb-3">Hız iyileştirme fırsatları</h2>
              <div className="border border-surface-border rounded-bosch overflow-hidden">
                {res.opportunities.map((o, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5 border-t border-surface-border first:border-t-0">
                    <span className="text-sm text-ink">{o.title}</span>
                    <span className="text-xs text-bosch-red font-medium whitespace-nowrap">{o.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEO ve GEO denetimi (kendi crawler'ımız) */}
          <CheckList title="SEO denetimi" items={res.seoChecks} />
          <CheckList title="GEO / zengin sonuç sinyalleri" items={res.geoChecks} />

          {res.crawlNote && <p className="text-xs text-ink-body">{res.crawlNote}</p>}
        </div>
      )}
    </div>
  );
}
