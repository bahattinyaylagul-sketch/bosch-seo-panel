"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { auditSite, listAuditSites, addAuditSite, deleteAuditSite, runSiteScan, getScanHistory, getScanReport, getLatestScanReport, type AuditData, type Check, type CheckGroup, type CheckStatus, type AuditSite, type ScanDiff, type ScanRow } from "./actions";
import type { ScoredDim } from "@/lib/audit-ai";
import { getMarkets, addCustomTasks, type MarketRow } from "../geo-checklist/actions";
import { useT } from "@/components/LangProvider";

const GREEN = "#00884A";
const AMBER = "#E88E00";
const RED = "#ED0007";
const BLUE = "#007BC0";

type Filter = "all" | "fail" | "warn" | "pass";

function scoreHex(v: number) { return v >= 80 ? GREEN : v >= 50 ? AMBER : RED; }
function healthHex(v: number) { return v >= 90 ? GREEN : v >= 70 ? BLUE : v >= 50 ? AMBER : RED; }

// ── Yüklenme (zamana bağlı 3 aşama, progress bar YOK) ──────────────────────
function AuditLoader() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 15000);
    const t2 = setTimeout(() => setPhase(2), 120000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const msg = phase === 0 ? "Sayfa taranıyor…" : phase === 1 ? "Site geneli tarama — 2 dakikaya kadar sürebilir…" : "Rapor hazırlanıyor…";
  return (
    <div className="border border-surface-border rounded-bosch p-6 max-w-xl">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 rounded-full border-[3px] border-surface-border border-t-bosch-red animate-spin shrink-0" />
        <div>
          <div className="text-sm font-semibold text-ink">{msg}</div>
          <div className="text-xs text-ink-body">Hız · teknik SEO · sayfa içi · GEO · site geneli denetleniyor.</div>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-bosch overflow-hidden bg-surface-border mt-5 relative">
        <div className="absolute inset-y-0 bosch-shimmer" style={{ width: "40%", background: "linear-gradient(90deg,#E2001A,#ED0007,#B90276,#50237F,#007BC0,#00A8B0,#78BE20)" }} />
      </div>
      <style>{`@keyframes boschshim{0%{left:-40%}100%{left:100%}} .bosch-shimmer{animation:boschshim 1.5s linear infinite}`}</style>
    </div>
  );
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

function HalfGauge({ value, hex }: { value: number; hex: string }) {
  const circ = Math.PI * 52;
  const off = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative" style={{ width: 130, height: 76 }}>
      <svg width={130} height={76} viewBox="0 0 120 70">
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="#E8EAED" strokeWidth="11" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={hex} strokeWidth="11" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex items-end justify-center pb-1">
        <span className="text-2xl font-semibold" style={{ color: hex }}>{value}%</span>
      </div>
    </div>
  );
}

function BigStat({ label, value, hex, sub, active, onClick }: { label: string; value: number; hex: string; sub?: string; active?: boolean; onClick?: () => void }) {
  const cls = "rounded-bosch border p-4 text-left transition-all";
  const inner = (
    <>
      <div className="text-xs text-ink-body mb-1">{label}</div>
      <div className="text-3xl font-semibold leading-none" style={{ color: hex }}>{value}</div>
      {sub && <div className="text-[11px] text-ink-body/70 mt-1.5">{sub}</div>}
    </>
  );
  if (!onClick) return <div className={`${cls} border-surface-border`}>{inner}</div>;
  return (
    <button onClick={onClick} className={`${cls} ${active ? "ring-2 ring-offset-1" : "hover:bg-surface-muted"}`}
      style={{ borderColor: active ? hex : "#E0E2E5", ...(active ? ({ ["--tw-ring-color" as any]: hex }) : {}) }}>
      {inner}
    </button>
  );
}

function SevBadge({ status }: { status: CheckStatus }) {
  const cfg = status === "fail" ? { t: "Hata", cls: "bg-bosch-red/10 text-bosch-red" }
    : status === "warn" ? { t: "Uyarı", cls: "bg-amber-500/10 text-amber-600" }
    : { t: "OK", cls: "bg-bosch-green/10 text-bosch-green" };
  return <span className={`rounded-bosch px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.t}</span>;
}
function Dot({ status }: { status: CheckStatus }) {
  const c = status === "pass" ? "bg-bosch-green" : status === "warn" ? "bg-amber-500" : "bg-bosch-red";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${c}`} />;
}

// ── Sorun satırı (info satırı ayrı stil) ───────────────────────────────────
function CheckRow({ c }: { c: Check }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const urls = c.urls ?? [];
  const shown = showAll ? urls : urls.slice(0, 5);

  function copyUrls() {
    navigator.clipboard.writeText(urls.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  if (c.info) {
    return (
      <div className="flex items-start gap-3 px-4 py-2.5 border-t border-surface-border first:border-t-0 opacity-70">
        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-ink-body/40 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm text-ink-body font-medium">{c.label}</div>
          <div className="text-xs text-ink-body/80 break-words">{c.detail}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-surface-border first:border-t-0">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/50 transition-colors">
        <Dot status={c.status} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink font-medium">{c.label}</div>
          <div className="text-xs text-ink-body break-words">{c.detail}</div>
        </div>
        {urls.length > 0 && <span className="text-[11px] text-ink-body bg-surface-muted rounded-bosch px-1.5 py-0.5 whitespace-nowrap">{urls.length} sayfa</span>}
        {c.scope !== "site" && urls.length === 0 && <span className="text-[11px] text-ink-body/70 bg-surface-muted rounded-bosch px-1.5 py-0.5 whitespace-nowrap">girilen sayfa</span>}
        <SevBadge status={c.status} />
        <span className="text-ink-body/50 text-xs w-4 text-center">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-9 space-y-2">
          {c.status !== "pass" && (
            <div className="text-xs bg-surface-muted rounded-bosch px-3 py-2 border-l-2" style={{ borderColor: c.status === "fail" ? RED : AMBER }}>
              <span className="font-medium text-ink">Öneri: </span>
              <span className="text-ink-body">{c.fix ?? "Bu alanı iyileştirin."}</span>
            </div>
          )}
          {urls.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-ink-body">Etkilenen sayfalar ({urls.length})</span>
                <button onClick={copyUrls} className="text-[11px] text-bosch-blue hover:underline">{copied ? "Kopyalandı ✓" : "URL'leri kopyala"}</button>
              </div>
              <div className="border border-surface-border rounded-bosch divide-y divide-surface-border">
                {shown.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 text-xs text-bosch-blue hover:bg-surface-muted break-all">{u}</a>
                ))}
              </div>
              {urls.length > 5 && (
                <button onClick={() => setShowAll((s) => !s)} className="mt-1.5 text-[11px] text-bosch-blue hover:underline">
                  {showAll ? "Daha az göster" : `Tümünü göster (${urls.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, filter, refCb }: { group: CheckGroup; filter: Filter; refCb?: (el: HTMLDivElement | null) => void }) {
  const [open, setOpen] = useState(true);
  const scorable = group.checks.filter((c) => !c.info);
  const err = scorable.filter((c) => c.status === "fail").length;
  const warn = scorable.filter((c) => c.status === "warn").length;
  const pass = scorable.filter((c) => c.status === "pass").length;
  const visible = filter === "all" ? group.checks : group.checks.filter((c) => !c.info && c.status === filter);
  if (!visible.length) return null;
  const isOpen = filter === "all" ? open : true;
  return (
    <div ref={refCb} className="border border-surface-border rounded-bosch overflow-hidden mb-4 scroll-mt-4">
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

function StatChip({ label, value, hex, active, onClick, sub }: { label: string; value: number; hex: string; active: boolean; onClick: () => void; sub?: string }) {
  return (
    <button onClick={onClick} className={`rounded-bosch border p-3 text-center transition-all ${active ? "ring-2 ring-offset-1" : "hover:bg-surface-muted"}`}
      style={{ borderColor: active ? hex : "#E0E2E5", ...(active ? ({ ["--tw-ring-color" as any]: hex }) : {}) }}>
      <div className="text-2xl font-semibold" style={{ color: hex }}>{value}</div>
      <div className="text-xs text-ink-body">{label}</div>
      {sub && <div className="text-[10px] text-ink-body/70 mt-0.5">{sub}</div>}
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
          <div className="min-w-0"><div className="text-sm text-ink font-medium">{d.label}</div><p className="text-xs text-ink-body break-words">{d.note}</p></div>
        </div>
      ))}
    </div>
  );
}

// ── Google SERP önizleme ───────────────────────────────────────────────────
function SerpPreview({ serp, contentStats, h1ok }: { serp: NonNullable<AuditData["serp"]>; contentStats?: AuditData["contentStats"]; h1ok: boolean | null }) {
  let pretty = serp.url;
  try { const u = new URL(serp.url); pretty = u.host + u.pathname.replace(/\/$/, ""); } catch {}
  const tLen = serp.title?.length ?? 0;
  const dLen = serp.desc?.length ?? 0;
  return (
    <div className="border border-surface-border rounded-bosch p-4 mb-4">
      <div className="text-sm font-semibold text-ink mb-3">Google SERP önizleme</div>
      <div className="max-w-xl">
        <div className="text-[12px] text-[#4d5156]">{pretty.replace(/\//g, " › ")}</div>
        <div className="text-[18px] leading-6 text-[#1a0dab] truncate">{serp.title ?? "Başlık yok"}</div>
        <div className="text-[13px] text-[#4d5156] line-clamp-2">{serp.desc ?? "Meta açıklama tespit edilemedi."}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Mini label="Title" value={`${tLen}/60`} ok={tLen >= 10 && tLen <= 60} />
        <Mini label="Meta" value={`${dLen}/160`} ok={dLen >= 50 && dLen <= 160} />
        <Mini label="H1" value={h1ok == null ? "?" : h1ok ? "var" : "yok"} ok={h1ok === true} />
        <Mini label="Metin/kod" value={contentStats ? `%${contentStats.textCodeRatio}` : "?"} ok={!!contentStats && contentStats.textCodeRatio >= 10} />
      </div>
    </div>
  );
}
function Mini({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-bosch border border-surface-border p-2 text-center">
      <div className="text-sm font-semibold" style={{ color: ok ? GREEN : AMBER }}>{value}</div>
      <div className="text-[11px] text-ink-body">{label}</div>
    </div>
  );
}

// ── Başlık ağacı ───────────────────────────────────────────────────────────
function HeadingTree({ headings }: { headings: NonNullable<AuditData["headings"]> }) {
  if (!headings.length) return null;
  let prev = 1;
  return (
    <div className="border border-surface-border rounded-bosch p-4 mb-4">
      <div className="text-sm font-semibold text-ink mb-2">Başlık ağacı</div>
      <div className="space-y-1">
        {headings.map((hd, i) => {
          const lvl = parseInt(hd.tag[1], 10);
          const skip = lvl > prev + 1;
          prev = lvl;
          return (
            <div key={i} className="text-xs text-ink-body flex items-center gap-1.5" style={{ paddingLeft: `${(lvl - 1) * 1}rem` }}>
              {skip && <span title="Seviye atlanmış" className="text-amber-600">⚠</span>}
              <span className="uppercase text-[10px] font-semibold text-ink-body/60">{hd.tag}</span>
              <span className="text-ink truncate">{hd.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sosyal önizleme ────────────────────────────────────────────────────────
function SocialPreview({ social, url }: { social: NonNullable<AuditData["social"]>; url: string }) {
  let domain = url; try { domain = new URL(url).host; } catch {}
  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-ink mb-3">Sosyal paylaşım önizleme</h2>
      <div className="border border-surface-border rounded-bosch overflow-hidden max-w-md">
        {social.ogImage ? (
          <img src={social.ogImage} alt="" className="w-full aspect-video object-cover bg-surface-muted" />
        ) : (
          <div className="w-full aspect-video bg-surface-muted flex items-center justify-center text-xs text-ink-body">og:image yok</div>
        )}
        <div className="p-3 bg-surface-muted">
          <div className="text-[11px] uppercase text-ink-body">{domain}</div>
          <div className="text-sm font-semibold text-ink truncate">{social.ogTitle ?? "og:title tespit edilemedi"}</div>
          <div className="text-xs text-ink-body line-clamp-2">{social.ogDesc ?? "og:description tespit edilemedi"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Görseller tablosu ──────────────────────────────────────────────────────
function decodeEntities(s: string) {
  return s.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function imgFileName(s: string) {
  try {
    const u = new URL(s);
    if (u.pathname.includes("/_next/image") || u.pathname.includes("/cdn-cgi/")) {
      const orig = u.searchParams.get("url");
      if (orig) { try { return decodeURIComponent(orig).split("?")[0].split("/").pop() || "görsel"; } catch { return "görsel"; } }
    }
    return u.pathname.split("/").pop() || u.host;
  } catch { return s.slice(0, 40); }
}
function ImagesTable({ list }: { list: NonNullable<AuditData["imagesList"]> }) {
  if (!list.length) return null;
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">Görseller ({list.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[520px]">
          <thead><tr className="text-ink-body text-left"><th className="px-3 py-2 font-medium">Önizleme</th><th className="px-3 py-2 font-medium">Dosya</th><th className="px-3 py-2 font-medium">Alt</th><th className="px-3 py-2 font-medium">KB</th><th className="px-3 py-2 font-medium">Durum</th></tr></thead>
          <tbody>
            {list.map((im, i) => {
              const st = im.status;
              const broken = st != null && (st === 404 || st === 410 || st >= 500);
              return (
                <tr key={i} className="border-t border-surface-border">
                  <td className="px-3 py-2"><img src={im.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} className="h-10 w-10 object-cover rounded bg-surface-muted" /></td>
                  <td className="px-3 py-2 text-ink break-all">{imgFileName(im.src)}</td>
                  <td className="px-3 py-2">{im.alt == null || im.alt === "" ? <span className="text-bosch-red font-medium">yok</span> : <span className="text-ink-body">{decodeEntities(im.alt).slice(0, 50)}</span>}</td>
                  <td className="px-3 py-2" style={{ color: im.kb != null && im.kb >= 70 ? AMBER : undefined }}>{im.kb ? im.kb : "—"}</td>
                  <td className="px-3 py-2" style={{ color: broken ? RED : undefined }}>{st == null ? "—" : broken ? st : "ok"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Linkler tablosu ────────────────────────────────────────────────────────
function LinksTable({ list }: { list: NonNullable<AuditData["linksList"]> }) {
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 10);
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">Linkler ({list.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[520px]">
          <thead><tr className="text-ink-body text-left"><th className="px-3 py-2 font-medium">Anchor</th><th className="px-3 py-2 font-medium">Tür</th><th className="px-3 py-2 font-medium">Durum</th></tr></thead>
          <tbody>
            {shown.map((ln, i) => (
              <tr key={i} className="border-t border-surface-border">
                <td className="px-3 py-2"><a href={ln.href} target="_blank" rel="noopener noreferrer" className="text-bosch-blue hover:underline break-all">{ln.anchor || short(ln.href)}</a></td>
                <td className="px-3 py-2"><span className="rounded-bosch bg-surface-muted px-1.5 py-0.5 text-ink-body">{ln.type === "internal" ? "iç" : "dış"}</span></td>
                <td className="px-3 py-2" style={{ color: ln.status != null && ln.status >= 400 ? RED : undefined }}>{ln.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > 10 && <button onClick={() => setAll((a) => !a)} className="w-full px-4 py-2 text-xs text-bosch-blue hover:bg-surface-muted border-t border-surface-border">{all ? "Daha az göster" : `Tümünü göster (${list.length})`}</button>}
    </div>
  );
  function short(s: string) { try { return new URL(s).host; } catch { return s.slice(0, 40); } }
}

// ── Performans (mobil/masaüstü sekme + CrUX) ───────────────────────────────
function PerfBlock({ data }: { data: AuditData }) {
  const [tab, setTab] = useState<"mobile" | "desktop">("mobile");
  const hasDesktop = !!data.perfDesktop;
  const active = tab === "desktop" && data.perfDesktop ? data.perfDesktop : { score: data.perfScore, metrics: data.metrics };
  const crux = data.crux;
  const hasCrux = crux && (crux.lcp || crux.inp || crux.cls);
  return (
    <div className="border border-surface-border rounded-bosch overflow-hidden mb-6">
      <div className="px-4 py-2.5 bg-surface-muted border-b border-surface-border flex items-center gap-3">
        {active.score != null && <Ring value={Math.round(active.score * 100)} size={40} stroke={4} />}
        <span className="text-sm font-semibold text-ink">Performans (Lighthouse lab)</span>
        {hasDesktop && (
          <span className="ml-auto flex gap-1">
            <button onClick={() => setTab("mobile")} className={`text-xs px-2 py-1 rounded-bosch ${tab === "mobile" ? "bg-bosch-blue text-white" : "text-ink-body hover:bg-surface-border/40"}`}>Mobil</button>
            <button onClick={() => setTab("desktop")} className={`text-xs px-2 py-1 rounded-bosch ${tab === "desktop" ? "bg-bosch-blue text-white" : "text-ink-body hover:bg-surface-border/40"}`}>Masaüstü</button>
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {active.metrics.map((m) => (
            <tr key={m.key} className="border-t border-surface-border first:border-t-0">
              <td className="px-4 py-2.5 text-ink-body w-44"><span className="inline-flex items-center gap-2"><Dot status={m.status} />{m.key}</span></td>
              <td className="px-4 py-2.5 text-ink font-medium text-right">{m.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasCrux && (
        <div className="border-t border-surface-border">
          <div className="px-4 py-2 text-xs font-semibold text-ink bg-surface-muted">Gerçek kullanıcı verisi (CrUX)</div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-t border-surface-border"><td className="px-4 py-2 text-ink-body w-44">LCP</td><td className="px-4 py-2 text-ink font-medium text-right">{crux!.lcp ?? "tespit edilemedi"}</td></tr>
              <tr className="border-t border-surface-border"><td className="px-4 py-2 text-ink-body">INP</td><td className="px-4 py-2 text-ink font-medium text-right">{crux!.inp ?? "tespit edilemedi"}</td></tr>
              <tr className="border-t border-surface-border"><td className="px-4 py-2 text-ink-body">CLS</td><td className="px-4 py-2 text-ink font-medium text-right">{crux!.cls ?? "tespit edilemedi"}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SEO Aksiyon Planı (AI, deterministik bulguları yorumlar) ───────────────
function SeoPlan({ plan }: { plan: NonNullable<AuditData["seoPlan"]> }) {
  const pr = (p: string) => p === "yüksek" ? { t: "Yüksek", c: RED } : p === "düşük" ? { t: "Düşük", c: GREEN } : { t: "Orta", c: AMBER };
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold text-ink">SEO Aksiyon Planı</h2>
        <span className="rounded-bosch bg-bosch-blue/10 text-bosch-blue text-[11px] px-2 py-0.5 font-medium">Claude ile</span>
      </div>
      <p className="text-xs text-ink-body mb-3">Denetim bulguları (gerçek sayılar) yapay zekâ ile yorumlanıp öncelik sırasına konuldu.</p>
      <div className="border border-surface-border rounded-bosch p-4 mb-3 bg-surface-muted">
        <p className="text-sm text-ink">{plan.summary}</p>
      </div>
      <div className="border border-surface-border rounded-bosch overflow-hidden">
        {plan.actions.map((a, i) => {
          const p = pr(a.priority);
          return (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-t border-surface-border first:border-t-0">
              <span className="rounded-bosch px-2 py-0.5 text-[11px] font-medium shrink-0 mt-0.5" style={{ backgroundColor: p.c + "1a", color: p.c }}>{p.t}</span>
              <div className="min-w-0">
                <div className="text-sm text-ink font-medium">{a.title}</div>
                {a.why && <p className="text-xs text-ink-body break-words">{a.why}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LOADER_STEPS = [
  "Sayfa çekiliyor ve ayrıştırılıyor",
  "Hız ölçülüyor (Google Lighthouse)",
  "Teknik SEO, görseller ve GEO denetleniyor",
  "Site geneli taranıyor (sitemap URL'leri)",
  "AI ile içerik & GEO analizi yapılıyor",
];

// Tarama sırasında Bosch supergraphic akışlı bar + dönen adım metni
function ScanBar() {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((p) => (p + 1) % LOADER_STEPS.length), 3000); return () => clearInterval(id); }, []);
  return (
    <div className="mt-3">
      <div className="h-1.5 w-full rounded-bosch overflow-hidden bg-surface-border relative">
        <div className="absolute inset-y-0 bosch-shimmer" style={{ width: "40%", background: "linear-gradient(90deg,#E2001A,#ED0007,#B90276,#50237F,#007BC0,#00A8B0,#78BE20)" }} />
      </div>
      <div className="text-[11px] text-ink-body mt-1.5">{LOADER_STEPS[i]}</div>
      <style>{`@keyframes boschshim{0%{left:-40%}100%{left:100%}} .bosch-shimmer{animation:boschshim 1.5s linear infinite}`}</style>
    </div>
  );
}

// ── Site Takibi: kalıcı site listesi + geçmişe göre "düzelen/yeni/devam" ────
function SiteTracker({ onReport }: { onReport: (d: AuditData, meta?: { diff?: ScanDiff; savedAt?: string }) => void }) {
  const [sites, setSites] = useState<AuditSite[] | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, ScanRow[]>>({});

  const load = () => { listAuditSites().then(setSites).catch(() => setSites([])); };
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const r = await addAuditSite(url, name); if (r.ok) { setUrl(""); setName(""); load(); } else setErr(r.error || "Eklenemedi"); }
    finally { setBusy(false); }
  }
  async function del(id: string) { await deleteAuditSite(id); load(); }
  async function scan(id: string) {
    setScanningId(id); setErr(null);
    try { const r = await runSiteScan(id); if (r.ok) { onReport(r.data, { diff: r.diff }); load(); } else setErr(r.error); }
    catch { setErr("Tarama sırasında hata"); }
    finally { setScanningId(null); }
  }
  async function openLatest(s: AuditSite) {
    setOpeningId(s.id); setErr(null);
    try { const d = await getLatestScanReport(s.id); if (d) onReport(d, { savedAt: s.last?.created_at }); else setErr("Kayıtlı rapor yok — önce tarayın."); }
    finally { setOpeningId(null); }
  }
  async function openScan(row: ScanRow) {
    setOpeningId(row.id); setErr(null);
    try { const d = await getScanReport(row.id); if (d) onReport(d, { savedAt: row.created_at }); else setErr("Rapor bulunamadı."); }
    finally { setOpeningId(null); }
  }
  async function toggleHistory(id: string) {
    if (historyOf === id) { setHistoryOf(null); return; }
    setHistoryOf(id);
    if (!histories[id]) { const rows = await getScanHistory(id); setHistories((h) => ({ ...h, [id]: rows })); }
  }
  const fmt = (s: string) => { try { return new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return s; } };

  return (
    <div>
      <div className="text-base font-semibold text-ink mb-1">Takip edilen siteler</div>
      <p className="text-xs text-ink-body mb-4">Site ekleyin, düzenli tarayın. <b>Rapor</b> ile son kayıtlı denetimi açın; <b>Geçmiş</b> ile eski taramaları görün. Her taramada bir öncekine göre <span className="text-bosch-green font-medium">düzelen</span> / <span className="text-bosch-red font-medium">yeni</span> sorunlar hesaplanır.</p>

      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://site.com/tr/" className="flex-1 rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Etiket (opsiyonel)" className="sm:w-48 rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue" />
        <button type="submit" disabled={busy} className="rounded-bosch bg-bosch-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap">{busy ? "Ekleniyor…" : "Site ekle"}</button>
      </form>
      {err && <p className="text-xs text-bosch-red mb-3">{err}</p>}

      {sites === null ? (
        <p className="text-xs text-ink-body">Yükleniyor…</p>
      ) : sites.length === 0 ? (
        <p className="text-xs text-ink-body">Henüz takip edilen site yok. Yukarıdan bir URL ekleyin.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sites.map((s) => {
            const scanning = scanningId === s.id;
            const opening = openingId === s.id;
            const hist = histories[s.id];
            return (
              <div key={s.id} className="border border-surface-border rounded-bosch p-4">
                <div className="flex items-center gap-3">
                  {scanning ? <span className="h-11 w-11 shrink-0 rounded-full border-[3px] border-surface-border border-t-bosch-red animate-spin" /> : s.last ? <Ring value={s.last.health} size={44} stroke={4} hex={healthHex(s.last.health)} /> : <span className="h-11 w-11 shrink-0 rounded-full border border-surface-border flex items-center justify-center text-[10px] text-ink-body">—</span>}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink font-semibold truncate">{s.name || s.url}</div>
                    <div className="text-xs text-ink-body break-all">{s.url}</div>
                    {s.last ? <div className="text-[11px] text-ink-body/70">Son tarama: {fmt(s.last.created_at)} · {s.last.errors} hata · {s.last.warnings} uyarı</div> : <div className="text-[11px] text-ink-body/70">Henüz taranmadı</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.last && <button onClick={() => openLatest(s)} disabled={opening} className="rounded-bosch border border-bosch-blue text-bosch-blue px-3 py-1.5 text-xs font-medium hover:bg-bosch-blue/5 transition-colors disabled:opacity-60 whitespace-nowrap">{opening ? "Açılıyor…" : "Rapor"}</button>}
                    <button onClick={() => scan(s.id)} disabled={scanning} className="rounded-bosch bg-bosch-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60 whitespace-nowrap">{scanning ? "Taranıyor…" : s.last ? "Yeniden tara" : "Tara"}</button>
                    {s.last && <button onClick={() => toggleHistory(s.id)} className="text-xs text-ink-body hover:text-ink whitespace-nowrap">Geçmiş</button>}
                    <button onClick={() => del(s.id)} className="text-xs text-ink-body/60 hover:text-bosch-red">Sil</button>
                  </div>
                </div>
                {scanning && <ScanBar />}
                {historyOf === s.id && (
                  <div className="mt-3 border border-surface-border rounded-bosch divide-y divide-surface-border">
                    {!hist ? <div className="px-3 py-2 text-xs text-ink-body">Yükleniyor…</div> : hist.length === 0 ? <div className="px-3 py-2 text-xs text-ink-body">Kayıt yok.</div> : hist.map((row) => (
                      <button key={row.id} onClick={() => openScan(row)} disabled={openingId === row.id} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted transition-colors disabled:opacity-60">
                        <span className="text-sm font-semibold w-8" style={{ color: healthHex(row.health) }}>{row.health}</span>
                        <span className="text-xs text-ink flex-1">{fmt(row.created_at)}</span>
                        <span className="text-xs text-bosch-red">{row.errors} hata</span>
                        <span className="text-xs text-amber-600">{row.warnings} uyarı</span>
                        <span className="text-xs text-bosch-blue">{openingId === row.id ? "Açılıyor…" : "Aç →"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Denetim sorunlarını GEO Checklist'e aktar
function ExportToChecklist({ data }: { data: AuditData }) {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [marketId, setMarketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { getMarkets().then((m) => { setMarkets(m); setMarketId(m[0]?.id ?? ""); }).catch(() => setMarkets([])); }, []);
  const items = useMemo(() => {
    const out: { title: string; descr: string; priority: string }[] = [];
    data.groups.forEach((g) => g.checks.forEach((c) => {
      if (c.info || c.status === "pass") return;
      out.push({ title: c.label, descr: c.detail + (c.fix ? " — Öneri: " + c.fix : ""), priority: c.status === "fail" ? "critical" : "high" });
    }));
    // AI/GEO analiz boyutları (düşük skorlular → görev, AI yorumu açıklama)
    if (data.ai) {
      const dims = [...data.ai.contentQuality, ...data.ai.eeat, ...data.ai.aiVisibility, ...data.ai.geo];
      dims.forEach((d) => { if (d.score < 60) out.push({ title: `AI/GEO: ${d.label}`, descr: `Skor ${d.score}/100 — ${d.note}`, priority: d.score < 40 ? "critical" : "high" }); });
    }
    return out;
  }, [data]);
  async function run() {
    setBusy(true); setMsg(null);
    try { const r = await addCustomTasks(marketId, items); setMsg(r.ok ? `${r.count} sorun GEO Checklist'e eklendi ✓` : (r.error || "Hata")); }
    catch { setMsg("Aktarım hatası"); }
    finally { setBusy(false); }
  }
  if (!markets || markets.length === 0) return null;
  return (
    <div className="border border-surface-border rounded-bosch p-3 mb-6 flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-body">Bu denetimin {items.length} sorununu GEO Checklist'e aktar:</span>
      <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className="rounded-bosch border border-surface-border bg-white px-2 py-1.5 text-xs text-ink outline-none">
        {markets.map((m) => <option key={m.id} value={m.id}>{m.code.toUpperCase()} · {m.name}</option>)}
      </select>
      <button onClick={run} disabled={busy || items.length === 0} className="rounded-bosch bg-bosch-blue px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60">{busy ? "Aktarılıyor…" : "Aktar"}</button>
      {msg && <span className="text-xs text-bosch-green">{msg}</span>}
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
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [reportMeta, setReportMeta] = useState<{ diff?: ScanDiff; savedAt?: string } | null>(null);
  const handleReport = (d: AuditData, meta?: { diff?: ScanDiff; savedAt?: string }) => { setRes(d); setReportMeta(meta ?? null); setFilter("all"); setError(null); typeof window !== "undefined" && window.scrollTo({ top: 0 }); };

  function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setRes(null); setReportMeta(null); setFilter("all");
    start(async () => {
      try {
        const r = await auditSite(url);
        if (r.ok) { setRes(r.data); setReportMeta(null); } else setError(r.error);
      } catch (err) { setError(err instanceof Error ? err.message : t("au.error")); }
    });
  }
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

  // Onlardaki gibi "N URL etkilendi" — severity başına etkilenen sayfa toplamı
  const affected = useMemo(() => {
    if (!res) return { fail: 0, warn: 0 };
    let f = 0, w = 0;
    res.groups.forEach((g) => g.checks.forEach((c) => {
      if (c.info) return;
      const n = c.urls?.length ?? 0;
      if (c.status === "fail") f += n; else if (c.status === "warn") w += n;
    }));
    return { fail: f, warn: w };
  }, [res]);
  const scrollToGroup = (id: string) => groupRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });

  // İlk düzeltilecekler (yalnız fail, urls?.length ?? 1 azalan)
  const topFixes = useMemo(() => {
    if (!res) return [];
    const fails: { c: Check; gid: string; gtitle: string }[] = [];
    res.groups.forEach((g) => g.checks.forEach((c) => { if (!c.info && c.status === "fail") fails.push({ c, gid: g.id, gtitle: g.title }); }));
    return fails.sort((a, b) => (b.c.urls?.length ?? 1) - (a.c.urls?.length ?? 1)).slice(0, 5);
  }, [res]);

  // Durum çipleri
  const statusChips = useMemo(() => {
    if (!res) return [];
    const find = (label: string) => res.groups.flatMap((g) => g.checks).find((c) => c.label.startsWith(label));
    const chips: { label: string; status: CheckStatus }[] = [];
    const http = find("HTTP durumu"); if (http) chips.push({ label: `HTTP ${http.detail}`, status: http.status });
    const idx = res.groups.flatMap((g) => g.checks).find((c) => c.label === "İndekslenebilirlik" || c.label === "noindex sayfalar");
    if (idx) chips.push({ label: idx.label === "noindex sayfalar" ? (idx.status === "pass" ? "İndekslenebilir" : "noindex var") : idx.detail, status: idx.status });
    const csr = find("Client-side rendering"); if (csr) chips.push({ label: csr.status === "pass" ? "CSR riski yok" : "CSR riski", status: csr.status });
    return chips;
  }, [res]);

  function exportCsv(data: AuditData) {
    const statusTr: Record<CheckStatus, string> = { fail: "Hata", warn: "Uyarı", pass: "OK" };
    const rows: string[][] = [["Grup", "Kontrol", "Durum", "Detay", "URL"]];
    data.groups.forEach((g) => g.checks.filter((c) => !c.info).forEach((c) => {
      if (c.urls && c.urls.length > 0) c.urls.forEach((u) => rows.push([g.title, c.label, statusTr[c.status], c.detail, u]));
      else rows.push([g.title, c.label, statusTr[c.status], c.detail, ""]);
    }));
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "site-denetimi.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  const h1Check = res?.groups.flatMap((g) => g.checks).find((c) => c.label === "H1 başlığı");
  const h1ok = h1Check ? h1Check.status === "pass" : null;

  return (
    <div>
      {!res && !pending && (
        <>
          <SiteTracker onReport={handleReport} />
          <div className="mt-8 pt-6 border-t border-surface-border">
            <div className="text-sm font-semibold text-ink mb-1">Tek seferlik denetim</div>
            <p className="text-xs text-ink-body mb-3">Kaydetmeden, tek bir URL için anlık denetim.</p>
            <form onSubmit={run} className="flex flex-col sm:flex-row gap-3 mb-2">
              <div className="flex-1">
                <label className="block text-xs text-ink-body mb-1">{t("au.url")}</label>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("au.placeholder")} className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue" />
              </div>
              <button type="submit" disabled={pending} className="self-stretch sm:self-end rounded-bosch bg-bosch-red px-5 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60 whitespace-nowrap">{t("au.button")}</button>
            </form>
            <p className="text-xs text-ink-body mb-2">{t("au.hint")}</p>
            {error && <p className="text-sm text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">{error}</p>}
          </div>
        </>
      )}

      {pending && !res && <AuditLoader />}

      {res && (
        <div>
          {/* ── ÜST BAR ── */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <button onClick={() => { setRes(null); setReportMeta(null); }} className="text-sm text-bosch-blue hover:underline font-medium">← Sitelere dön</button>
            <button onClick={() => exportCsv(res)} className="shrink-0 rounded-bosch border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted transition-colors whitespace-nowrap">⬇ CSV dışa aktar</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <p className="text-xs text-ink-body break-all">{res.finalUrl}</p>
            {reportMeta?.savedAt && <span className="shrink-0 rounded-bosch bg-surface-muted text-ink-body text-[11px] px-2 py-0.5">Kayıtlı rapor · {new Date(reportMeta.savedAt).toLocaleString("tr-TR")}</span>}
          </div>
          {reportMeta?.diff && (
            <div className="rounded-bosch border border-surface-border bg-surface-muted p-3 mb-4 text-xs">
              {reportMeta.diff.hasPrev ? (
                <div className="flex flex-wrap gap-4">
                  <span className="text-bosch-green font-medium">✓ {reportMeta.diff.fixed} sorun düzeldi</span>
                  <span className="text-bosch-red font-medium">＋ {reportMeta.diff.newer} yeni sorun</span>
                  <span className="text-ink-body">• {reportMeta.diff.ongoing} devam eden</span>
                </div>
              ) : <span className="text-ink-body">İlk tarama kaydedildi — sonraki taramada karşılaştırma çıkacak.</span>}
            </div>
          )}
          {filter === "all" && <ExportToChecklist data={res} />}

          {/* ── DASHBOARD: sağlık + sayaçlar ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="border border-surface-border rounded-bosch p-4 flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-ink self-start mb-1">Site Sağlığı</div>
              <HalfGauge value={res.health} hex={healthHex(res.health)} />
              <div className="text-[11px] text-ink-body mt-0.5">Hedef: 90+</div>
            </div>
            <BigStat label="Hata" value={res.counts.errors} hex={RED} sub={affected.fail > 0 ? `${affected.fail} URL etkilendi` : undefined} active={filter === "fail"} onClick={() => toggle("fail")} />
            <BigStat label="Uyarı" value={res.counts.warnings} hex={AMBER} sub={affected.warn > 0 ? `${affected.warn} URL etkilendi` : undefined} active={filter === "warn"} onClick={() => toggle("warn")} />
          </div>
          {filter !== "all" && <button onClick={() => setFilter("all")} className="text-xs text-bosch-blue underline font-medium mb-4">← Tümünü göster</button>}


          {/* ── SEO AKSİYON PLANI (AI) ── */}
          {filter === "all" && res.seoPlan && <SeoPlan plan={res.seoPlan} />}

          {/* ── PERFORMANS (mobil/masaüstü + CrUX) ── */}
          {filter === "all" && <PerfBlock data={res} />}

          {/* ── İÇERİK BÖLÜMÜ (onpage grubunun üstünde) ── */}
          {filter === "all" && res.serp && <SerpPreview serp={res.serp} contentStats={res.contentStats} h1ok={h1ok} />}
          {filter === "all" && res.headings && res.headings.length > 0 && <HeadingTree headings={res.headings} />}
          {filter === "all" && res.contentStats && res.contentStats.topWords.length > 0 && (
            <div className="border border-surface-border rounded-bosch p-4 mb-4">
              <div className="text-sm font-semibold text-ink mb-2">En sık kelimeler</div>
              <div className="flex flex-wrap gap-2">
                {res.contentStats.topWords.map((w, i) => (
                  <span key={i} className="rounded-bosch bg-surface-muted border border-surface-border text-xs px-2 py-1 text-ink-body">{w.word} <span className="text-ink-body/60">×{w.count}</span></span>
                ))}
              </div>
            </div>
          )}

          {/* ── GRUPLAR (görseller & linkler tabloları ilgili gruptan önce) ── */}
          {res.groups.map((g) => (
            <div key={g.id}>
              {filter === "all" && g.id === "images" && res.imagesList && <ImagesTable list={res.imagesList} />}
              <GroupCard group={g} filter={filter} refCb={(el) => (groupRefs.current[g.id] = el)} />
              {filter === "all" && g.id === "perf" && res.opportunities.length > 0 && (
                <div className="border border-surface-border rounded-bosch overflow-hidden mb-4">
                  <div className="px-4 py-2.5 bg-surface-muted text-sm font-semibold text-ink border-b border-surface-border">Hız iyileştirme fırsatları (çözümler)</div>
                  {res.opportunities.map((o, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5 border-t border-surface-border first:border-t-0">
                      <span className="text-sm text-ink">{o.title}</span>
                      <span className="text-xs text-bosch-red font-medium whitespace-nowrap">{o.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* ── AI / GEO ── */}
          {res.ai && filter === "all" && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-ink">AI Görünürlük & GEO Analizi</h2>
                <span className="rounded-bosch bg-bosch-blue/10 text-bosch-blue text-[11px] px-2 py-0.5 font-medium">Claude ile</span>
              </div>
              <p className="text-xs text-ink-body mb-4">Site geneli mekanik bulgular (yüzdeler) + temsilî sayfa metni tek bir Claude çağrısıyla yorumlandı — üretken arama motorları (AI Overview, ChatGPT, Perplexity) için tahmini skorlar.</p>
              <div className="border border-surface-border rounded-bosch p-5 mb-4 flex items-center gap-5">
                <Ring value={res.ai.overall} size={96} stroke={9} />
                <div><div className="text-base font-semibold text-ink mb-0.5">Genel AI/GEO skoru</div><p className="text-xs text-ink-body leading-relaxed">{res.ai.summary}</p></div>
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
                      <div className="flex flex-wrap gap-2">{res.ai.entities.map((e, i) => <span key={i} className="rounded-bosch bg-surface-muted border border-surface-border text-xs px-2 py-1 text-ink-body">{e}</span>)}</div>
                    </div>
                  )}
                  {res.ai.missingEntities.length > 0 && (
                    <div className="border border-surface-border rounded-bosch p-4">
                      <div className="text-sm font-semibold text-ink mb-2">Eksik / önerilen varlıklar</div>
                      <div className="flex flex-wrap gap-2">{res.ai.missingEntities.map((e, i) => <span key={i} className="rounded-bosch bg-bosch-red/5 border border-bosch-red/30 text-xs px-2 py-1 text-bosch-red">{e}</span>)}</div>
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
