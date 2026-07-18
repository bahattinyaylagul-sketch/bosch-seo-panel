"use client";

import { useState, useTransition } from "react";
import { auditSite, type AuditData, type Check, type CheckGroup, type CheckStatus } from "./actions";
import type { ScoredDim } from "@/lib/audit-ai";
import { useT } from "@/components/LangProvider";

type Filter = "all" | "fail" | "warn" | "pass";

const GREEN = "#00884A";
const AMBER = "#E88E00";
const RED = "#ED0007";

function scoreHex(v: number) {
  return v >= 80 ? GREEN : v >= 50 ? AMBER : RED;
}
function healthHex(v: number) {
  return v >= 90 ? GREEN : v >= 70 ? "#007BC0" : v >= 50 ? AMBER : RED;
}

function Ring({ value, size = 60, stroke = 6, hex, label }: { value: number; size?: number; stroke?: number; hex?: string; label?: string }) {
  const col = hex ?? scoreHex(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8EAED" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-semibold" style={{ color: col, fontSize: size * 0.28 }}>{value}</span>
        {label && <span className="text-ink-body mt-0.5" style={{ fontSize: size * 0.13 }}>{label}</span>}
      </div>
    </div>
  );
}

function SevBadge({ status }: { status: CheckStatus }) {
  const cfg =
    status === "fail"
      ? { t: "Hata", cls: "bg-bosch-red/10 text-bosch-red" }
      : status === "warn"
        ? { t: "Uyarı", cls: "bg-amber-500/10 text-amber-600" }
        : { t: "OK", cls: "bg-bosch-green/10 text-bosch-green" };
  return <span className={`rounded-bosch px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.t}</span>;
}

function Dot({ status }: { status: CheckStatus }) {
  const c = status === "pass" ? "bg-bosch-green" : status === "warn" ? "bg-amber-500" : "bg-bosch-red";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${c}`} />;
}

function CheckRow({ c }: { c: Check }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-surface-border first:border-t-0">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/50 transition-colors">
        <Dot status={c.status} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink font-medium">{c.label}</div>
          <div className="text-xs text-ink-body break-words">{c.detail}</div>
        </div>
        <SevBadge status={c.status} />
        <span className="text-ink-body/50 text-xs w-4 text-center">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-9">
          {c.status === "pass" ? (
            <p className="text-xs text-ink-body bg-surface-muted rounded-bosch px-3 py-2">Bu kontrol başarılı — aksiyon gerekmiyor.</p>
          ) : (
            <div className="text-xs bg-surface-muted rounded-bosch px-3 py-2 border-l-2" style={{ borderColor: c.status === "fail" ? RED : AMBER }}>
              <span className="font-medium text-ink">Öneri: </span>
              <span className="text-ink-body">{c.fix ?? "Bu alanı iyileştirin."}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, filter }: { group: CheckGroup; filter: Filter }) {
  const [open, setOpen] = useState(true);
  const err = group.checks.filter((c) => c.status === "fail").length;
  const warn = group.checks.filter((c) => c.status === "warn").length;
  const pass = group.checks.filter((c) => c.status === "pass").length;
  const visible = filter === "all" ? group.checks : group.checks.filter((c) => c.status === filter);
  if (!visible.length) return null;
  const isOpen = filter === "all" ? open : true;
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden mb-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-muted hover:bg-surface-border/40 transition-colors text-left">
        <span className="text-sm font-semibold text-ink">{group.title}</span>
        <span className="flex items-center gap-2.5 text-xs">
          {err > 0 && <span className="text-bosch-red font-medium">{err} hata</span>}
          {warn > 0 && <span className="text-amber-600 font-medium">{warn} uyarı</span>}
          <span className="text-bosch-green font-medium">{pass} ok</span>
          {filter === "all" && <span className="text-ink-body/50 w-4 text-center">{open ? "▾" : "▸"}</span>}
        </span>
      </button>
      {isOpen && <div>{visible.map((c, i) => <CheckRow key={i} c={c} />)}</div>}
    </div>
  );
}

function StatChip({ label, value, hex, active, onClick }: { label: string; value: number; hex: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-bosch border p-3 text-center transition-all ${active ? "ring-2 ring-offset-1" : "hover:bg-surface-muted"}`}
      style={{ borderColor: active ? hex : "var(--surface-border, #E0E2E5)", ...(active ? ({ ["--tw-ring-color" as any]: hex }) : {}) }}
    >
      <div className="text-2xl font-semibold" style={{ color: hex }}>{value}</div>
      <div className="text-xs text-ink-body">{label}</div>
    </button>
  );
}

function AiSection({ title, dims }: { title: string; dims: ScoredDim[] }) {
  if (!dims.length) return null;
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">{title}</div>
      {dims.map((d) => (
        <div key={d.key} className="flex items-center gap-3 px-4 py-3 border-t border-surface-border first:border-t-0">
          <Ring value={d.score} size={48} stroke={5} />
          <div className="min-w-0">
            <div className="text-sm text-ink font-medium">{d.label}</div>
            <p className="text-xs text-ink-body break-words">{d.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuditTool() {
  const t = useT();
  const [url, setUrl] = useState("");
  const [res, setRes] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, start] = useTransition();

  function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRes(null);
    setFilter("all");
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

  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

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
            <Ring value={res.health} size={132} stroke={12} hex={healthHex(res.health)} label="/ 100" />
            <div className="flex-1 w-full">
              <div className="text-base font-semibold text-ink mb-1">Site sağlık skoru</div>
              <p className="text-xs text-ink-body mb-4">
                {res.groups.reduce((n, g) => n + g.checks.length, 0)} kontrol · hız, teknik SEO, sayfa içi SEO ve GEO sinyalleri.
                {filter !== "all" && <span className="text-bosch-blue"> · Filtre etkin, temizlemek için çipe tekrar tıklayın.</span>}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <StatChip label="Hata" value={res.counts.errors} hex={RED} active={filter === "fail"} onClick={() => toggle("fail")} />
                <StatChip label="Uyarı" value={res.counts.warnings} hex={AMBER} active={filter === "warn"} onClick={() => toggle("warn")} />
                <StatChip label="Başarılı" value={res.counts.passes} hex={GREEN} active={filter === "pass"} onClick={() => toggle("pass")} />
              </div>
            </div>
          </div>

          {/* Core Web Vitals + hız fırsatları */}
          {filter === "all" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="border border-surface-border rounded-bosch overflow-hidden">
                <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border flex items-center gap-3">
                  {res.perfScore !== null && <Ring value={Math.round(res.perfScore * 100)} size={40} stroke={4} />}
                  Core Web Vitals
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {res.metrics.map((m) => (
                      <tr key={m.key} className="border-t border-surface-border first:border-t-0">
                        <td className="px-4 py-2.5 text-ink-body w-40"><span className="inline-flex items-center gap-2"><Dot status={m.status} />{m.key}</span></td>
                        <td className="px-4 py-2.5 text-ink font-medium text-right">{m.value}</td>
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
          )}

          {/* Kategori bazlı denetim */}
          {res.groups.map((g) => <GroupCard key={g.id} group={g} filter={filter} />)}

          {/* AI destekli GEO / İçerik analizi */}
          {res.ai && filter === "all" && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-ink">AI Görünürlük & GEO Analizi</h2>
                <span className="rounded-bosch bg-bosch-blue/10 text-bosch-blue text-[11px] px-2 py-0.5 font-medium">Claude ile</span>
              </div>
              <p className="text-xs text-ink-body mb-4">
                Yapay zekâ ile içerik değerlendirmesi — klasik SEO araçlarında bulunmayan, üretken arama motorları (AI Overview, ChatGPT, Perplexity) için tahmini skorlar.
              </p>

              <div className="border border-surface-border rounded-bosch p-5 mb-4 flex items-center gap-5">
                <Ring value={res.ai.overall} size={96} stroke={9} />
                <div>
                  <div className="text-base font-semibold text-ink mb-0.5">Genel AI/GEO skoru</div>
                  <p className="text-xs text-ink-body leading-relaxed">{res.ai.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <AiSection title="İçerik Kalitesi & Semantik SEO" dims={res.ai.contentQuality} />
                <AiSection title="E-E-A-T (Otorite & Güven)" dims={res.ai.eeat} />
                <AiSection title="AI Görünürlüğü" dims={res.ai.aiVisibility} />
                <AiSection title="GEO (Generative Engine Optimization)" dims={res.ai.geo} />
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
