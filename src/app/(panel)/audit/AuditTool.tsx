"use client";

import { useState, useTransition } from "react";
import { auditSite, type AuditData } from "./actions";
import { useT } from "@/components/LangProvider";

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  const pct = score === null ? null : Math.round(score * 100);
  const color =
    pct === null ? "text-ink-body" : pct >= 90 ? "text-bosch-green" : pct >= 50 ? "text-bosch-blue" : "text-bosch-red";
  const bar =
    pct === null ? "bg-surface-border" : pct >= 90 ? "bg-bosch-green" : pct >= 50 ? "bg-bosch-blue" : "bg-bosch-red";
  return (
    <div className="bg-surface-muted border border-surface-border rounded-bosch p-4">
      <div className="text-xs text-ink-body mb-1">{label}</div>
      <div className={`text-3xl font-semibold ${color}`}>{pct === null ? "—" : pct}</div>
      <div className="mt-2 h-1.5 rounded-bosch bg-surface-border overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct ?? 0}%` }} />
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

      {pending && !res && (
        <div className="text-sm text-ink-body">{t("au.running")}</div>
      )}

      {res && (
        <div>
          <p className="text-xs text-ink-body mb-3 break-all">{res.finalUrl}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <ScoreCard label={t("au.performance")} score={res.scores.performance} />
            <ScoreCard label={t("au.seo")} score={res.scores.seo} />
            <ScoreCard label={t("au.accessibility")} score={res.scores.accessibility} />
            <ScoreCard label={t("au.bestPractices")} score={res.scores.bestPractices} />
          </div>

          <h2 className="text-sm font-semibold text-ink mb-3">{t("au.cwv")}</h2>
          <div className="border border-surface-border rounded-bosch overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
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
      )}
    </div>
  );
}
