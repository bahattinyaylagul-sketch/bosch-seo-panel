"use client";

import { useState, useTransition } from "react";
import { auditSite, type AuditData, type Check, type CheckGroup, type CheckStatus } from "./actions";
import type { ScoredDim } from "@/lib/audit-ai";
import { useT } from "@/components/LangProvider";

function healthColor(v: number) {
  if (v >= 90) return "#00884A"; // bosch-green
  if (v >= 70) return "#007BC0"; // bosch-blue
  if (v >= 50) return "#E88E00"; // amber
  return "#ED0007"; // bosch-red
}

function HealthGauge({ value }: { value: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  const col = healthColor(value);
  return (
    <div className="relative h-[136px] w-[136px] shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#E8EAED" strokeWidth="12" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold" style={{ color: col }}>{value}</span>
        <span className="text-[10px] text-ink-body">/ 100</span>
      </div>
    </div>
  );
}

function Dot({ status }: { status: CheckStatus }) {
  const c = status === "pass" ? "bg-bosch-green" : status === "warn" ? "bg-amber-500" : "bg-bosch-red";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${c}`} />;
}

function ScoreBar({ d }: { d: ScoredDim }) {
  const col = d.score >= 80 ? "#00884A" : d.score >= 50 ? "#E88E00" : "#ED0007";
  return (
    <div className="px-4 py-3 border-t border-surface-border">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-sm text-ink font-medium">{d.label}</span>
        <span className="text-sm font-semibold" style={{ color: col }}>{d.score}</span>
      </div>
      <div className="h-1.5 rounded-bosch bg-surface-border overflow-hidden mb-1.5">
        <div className="h-full" style={{ width: `${d.score}%`, backgroundColor: col }} />
      </div>
      <p className="text-xs text-ink-body">{d.note}</p>
    </div>
  );
}

function AiScoreCard({ title, dims }: { title: string; dims: ScoredDim[] }) {
  if (!dims.length) return null;
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">{title}</div>
      {dims.map((d) => <ScoreBar key={d.key} d={d} />)}
    </div>
  );
}

function GroupCard({ group }: { group: CheckGroup }) {
  const [open, setOpen] = useState(true);
  const err = group.checks.filter((c) => c.status === "fail").length;
  const warn = group.checks.filter((c) => c.status === "warn").length;
  const pass = group.checks.filter((c) => c.status === "pass").length;
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden mb-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-muted hover:bg-surface-border/40 transition-colors text-left">
        <span className="text-sm font-semibold text-ink">{group.title}</span>
        <span className="flex items-center gap-3 text-xs">
          {err > 0 && <span className="text-bosch-red font-medium">{err} hata</span>}
          {warn > 0 && <span className="text-amber-600 font-medium">{warn} uyarı</span>}
          <span className="text-bosch-green font-medium">{pass} ok</span>
          <span className="text-ink-body">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <div>
          {group.checks.map((c, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-t border-surface-border">
              <span className="mt-1.5"><Dot status={c.status} /></span>
              <div className="min-w-0">
                <div className="text-sm text-ink font-medium">{c.label}</div>
                <div className="text-xs text-ink-body break-words">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
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
        <button type="submit" disabled={pending} className="self-stretch sm:self-end rounded-bosch bg-bosch-red px-5 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60 whitespace-nowrap">
          {pending ? t("au.running") : t("au.button")}
        </button>
      </form>
      <p className="text-xs text-ink-body mb-6">{t("au.hint")}</p>

      {error && <p className="text-sm text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">{error}</p>}
      {pending && !res && <div className="text-sm text-ink-body">{t("au.running")} — sayfa taranıyor, hız + SEO + GEO denetleniyor…</div>}

      {res && (
        <div>
          <p className="text-xs text-ink-body mb-4 break-all">{res.finalUrl}</p>

          {/* Sağlık skoru hero */}
          <div className="border border-surface-border rounded-bosch p-5 mb-6 flex flex-col sm:flex-row items-center gap-6">
            <HealthGauge value={res.health} />
            <div className="flex-1 w-full">
              <div className="text-sm font-semibold text-ink mb-1">Site sağlık skoru</div>
              <p className="text-xs text-ink-body mb-4">{res.groups.reduce((n, g) => n + g.checks.length, 0)} kontrol · hız, teknik SEO, sayfa içi SEO ve GEO sinyalleri</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-bosch bg-surface-muted border border-surface-border p-3 text-center">
                  <div className="text-2xl font-semibold text-bosch-red">{res.counts.errors}</div>
                  <div className="text-xs text-ink-body">Hata</div>
                </div>
                <div className="rounded-bosch bg-surface-muted border border-surface-border p-3 text-center">
                  <div className="text-2xl font-semibold text-amber-600">{res.counts.warnings}</div>
                  <div className="text-xs text-ink-body">Uyarı</div>
                </div>
                <div className="rounded-bosch bg-surface-muted border border-surface-border p-3 text-center">
                  <div className="text-2xl font-semibold text-bosch-green">{res.counts.passes}</div>
                  <div className="text-xs text-ink-body">Başarılı</div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Web Vitals + hız fırsatları */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="border border-surface-border rounded-bosch overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">Core Web Vitals</div>
              <table className="w-full text-sm">
                <tbody>
                  {res.metrics.map((m) => (
                    <tr key={m.key} className="border-t border-surface-border first:border-t-0">
                      <td className="px-4 py-2.5 text-ink-body w-40 flex items-center gap-2"><Dot status={m.status} />{m.key}</td>
                      <td className="px-4 py-2.5 text-ink font-medium">{m.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border border-surface-border rounded-bosch overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">Hız iyileştirme fırsatları</div>
              {res.opportunities.length > 0 ? (
                res.opportunities.map((o, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5 border-t border-surface-border first:border-t-0">
                    <span className="text-sm text-ink">{o.title}</span>
                    <span className="text-xs text-bosch-red font-medium whitespace-nowrap">{o.value}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-ink-body">Önemli bir hız fırsatı bulunamadı 👍</div>
              )}
            </div>
          </div>

          {/* Kategori bazlı denetim */}
          {res.groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}

          {/* AI destekli GEO / İçerik analizi */}
          {res.ai && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-ink">AI Görünürlük & GEO Analizi</h2>
                <span className="rounded-bosch bg-bosch-blue/10 text-bosch-blue text-[11px] px-2 py-0.5 font-medium">Claude ile</span>
              </div>
              <p className="text-xs text-ink-body mb-4">
                Yapay zekâ ile içerik değerlendirmesi — klasik SEO araçlarında bulunmayan, üretken arama motorları (AI Overview, ChatGPT, Perplexity) için tahmini skorlar.
              </p>

              <div className="border border-surface-border rounded-bosch p-4 mb-4 flex items-center gap-4">
                <div className="text-4xl font-semibold" style={{ color: res.ai.overall >= 80 ? "#00884A" : res.ai.overall >= 50 ? "#E88E00" : "#ED0007" }}>
                  {res.ai.overall}
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">Genel AI/GEO skoru</div>
                  <p className="text-xs text-ink-body">{res.ai.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <AiScoreCard title="İçerik Kalitesi & Semantik SEO" dims={res.ai.contentQuality} />
                <AiScoreCard title="E-E-A-T (Otorite & Güven)" dims={res.ai.eeat} />
                <AiScoreCard title="AI Görünürlüğü" dims={res.ai.aiVisibility} />
                <AiScoreCard title="GEO (Generative Engine Optimization)" dims={res.ai.geo} />
              </div>

              {(res.ai.entities.length > 0 || res.ai.missingEntities.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {res.ai.entities.length > 0 && (
                    <div className="border border-surface-border rounded-bosch p-4">
                      <div className="text-sm font-semibold text-ink mb-2">Sayfadaki ana varlıklar</div>
                      <div className="flex flex-wrap gap-2">
                        {res.ai.entities.map((e, i) => (
                          <span key={i} className="rounded-bosch bg-surface-muted border border-surface-border text-xs px-2 py-1 text-ink-body">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {res.ai.missingEntities.length > 0 && (
                    <div className="border border-surface-border rounded-bosch p-4">
                      <div className="text-sm font-semibold text-ink mb-2">Eksik / önerilen varlıklar</div>
                      <div className="flex flex-wrap gap-2">
                        {res.ai.missingEntities.map((e, i) => (
                          <span key={i} className="rounded-bosch bg-bosch-red/5 border border-bosch-red/30 text-xs px-2 py-1 text-bosch-red">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
