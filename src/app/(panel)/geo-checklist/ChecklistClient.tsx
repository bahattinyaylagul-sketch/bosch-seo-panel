"use client";

import { useEffect, useMemo, useState } from "react";
import { type Priority, type TaskStatus } from "@/lib/geo-checklist";
import { getTaskStatuses, setTaskStatus, setTaskNote, getCustomTasks, deleteCustomTask, type MarketRow, type TaskState, type CustomTask } from "./actions";

const RED = "#ED0007", AMBER = "#E88E00", BLUE = "#007BC0", GREEN = "#00884A";
const PRI: Record<Priority, { t: string; c: string }> = {
  critical: { t: "Kritik", c: RED }, high: { t: "Yüksek", c: AMBER }, medium: { t: "Orta", c: BLUE }, low: { t: "Düşük", c: "#6b7280" },
};

function Ring({ value, size = 56, stroke = 6 }: { value: number; size?: number; stroke?: number }) {
  const col = value >= 70 ? GREEN : value >= 40 ? AMBER : RED;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8EAED" strokeWidth={stroke} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} /></svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold" style={{ color: col }}>{value}%</div>
    </div>
  );
}

export default function ChecklistClient({ markets }: { markets: MarketRow[] }) {
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [states, setStates] = useState<Record<string, TaskState>>({});
  const [custom, setCustom] = useState<CustomTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [fPri, setFPri] = useState<string>("all");
  const [fStat, setFStat] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!marketId) return;
    setLoading(true);
    Promise.all([getTaskStatuses(marketId), getCustomTasks(marketId)])
      .then(([st, cs]) => { setStates(st); setCustom(cs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [marketId]);
  async function removeCustom(id: string) { setCustom((c) => c.filter((x) => x.id !== id)); await deleteCustomTask(id); }

  const stOf = (id: string): TaskStatus => states[id]?.status ?? "todo";
  async function changeStatus(id: string, s: TaskStatus) {
    setStates((p) => ({ ...p, [id]: { status: s, note: p[id]?.note ?? null } }));
    await setTaskStatus(id, marketId, s);
  }
  async function saveNote(id: string, note: string) {
    setStates((p) => ({ ...p, [id]: { status: p[id]?.status ?? "todo", note } }));
    await setTaskNote(id, marketId, note);
  }

  const PTS: Record<string, number> = { critical: 10, high: 8, medium: 6, low: 4 };
  const stats = useMemo(() => {
    let earned = 0, total = 0, done = 0, doing = 0, criticalPending = 0;
    for (const t of custom) {
      const pts = PTS[t.priority] ?? 8; total += pts;
      const s = stOf(t.id);
      if (s === "done") { earned += pts; done++; }
      else if (s === "doing") { earned += pts * 0.5; doing++; }
      if (t.priority === "critical" && s !== "done") criticalPending++;
    }
    return { earned: Math.round(earned), total, done, doing, criticalPending, count: custom.length, pct: total ? Math.round((100 * earned) / total) : 0 };
  }, [states, custom]);

  const visibleCustom = custom.filter((t) => {
    if (fPri !== "all" && t.priority !== fPri) return false;
    if (fStat !== "all" && stOf(t.id) !== fStat) return false;
    if (q && !((t.title + " " + (t.descr ?? "")).toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div>
      {/* ── Üst kartlar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-xs text-ink-body">Pazar:</span>
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className="rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue">
          {markets.length === 0 && <option value="">Pazar yok</option>}
          {markets.map((m) => <option key={m.id} value={m.id}>{m.code.toUpperCase()} · {m.name}</option>)}
        </select>
        {loading && <span className="text-xs text-ink-body">Yükleniyor…</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="border border-surface-border rounded-bosch p-4 flex items-center gap-3">
          <Ring value={stats.pct} />
          <div><div className="text-xs text-ink-body">Genel GEO Skoru</div><div className="text-[11px] text-ink-body/70">{stats.earned} / {stats.total} puan</div></div>
        </div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">Toplam Görev</div><div className="text-3xl font-semibold text-ink">{stats.count}</div></div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">Tamamlanan</div><div className="text-3xl font-semibold text-bosch-green">{stats.done}</div></div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">Devam Eden</div><div className="text-3xl font-semibold text-amber-600">{stats.doing}</div></div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">Kritik Bekleyen</div><div className="text-3xl font-semibold text-bosch-red">{stats.criticalPending}</div></div>
      </div>

      {/* ── Filtreler ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Görev ara…" className="flex-1 min-w-[180px] rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue" />
        <select value={fPri} onChange={(e) => setFPri(e.target.value)} className="rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none">
          <option value="all">Tüm Öncelikler</option><option value="critical">Kritik</option><option value="high">Yüksek</option><option value="medium">Orta</option><option value="low">Düşük</option>
        </select>
        <select value={fStat} onChange={(e) => setFStat(e.target.value)} className="rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none">
          <option value="all">Tüm Durumlar</option><option value="todo">Başlanmadı</option><option value="doing">Devam Ediyor</option><option value="done">Tamamlandı</option>
        </select>
      </div>

      {/* ── Denetim bulguları (iş takibi) ── */}
      {custom.length === 0 && (
        <div className="border border-surface-border rounded-bosch p-8 text-center">
          <div className="text-sm font-medium text-ink mb-1">Bu pazar için henüz görev yok</div>
          <div className="text-xs text-ink-body">Site Denetimi&apos;nde bir siteyi tarayın, rapor içindeki <span className="font-medium">&ldquo;Checklist&apos;e aktar&rdquo;</span> ile bulunan eksikleri buraya görev olarak ekleyin.</div>
        </div>
      )}
      {custom.length > 0 && (
        <div className="border border-bosch-blue/30 rounded-bosch mb-4 overflow-hidden">
          <div className="px-4 py-3 bg-bosch-blue/5 text-sm font-semibold text-ink flex items-center justify-between">
            <span>Denetim Bulguları — İş Takibi</span>
            <span className="text-xs font-normal text-ink-body">{visibleCustom.length} / {custom.length} görev</span>
          </div>
          {visibleCustom.map((t) => {
            const s = stOf(t.id);
            const expanded = open === t.id;
            const pri = PRI[(t.priority as Priority)] ?? PRI.high;
            return (
              <div key={t.id} className="border-t border-surface-border">
                <div className="w-full flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpen(expanded ? null : t.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px]" style={{ background: s === "done" ? GREEN : s === "doing" ? AMBER : "transparent", border: s === "todo" ? "1px solid #d1d5db" : "none", color: "#fff" }}>{s === "done" ? "✓" : s === "doing" ? "…" : ""}</span>
                    <span className={`flex-1 truncate text-sm ${s === "done" ? "line-through text-ink-body" : "text-ink font-medium"}`}>{t.title}</span>
                  </button>
                  <span className="rounded-bosch text-[11px] px-2 py-0.5 font-medium whitespace-nowrap" style={{ backgroundColor: pri.c + "1a", color: pri.c }}>{pri.t}</span>
                  <button onClick={() => removeCustom(t.id)} className="text-xs text-ink-body/60 hover:text-bosch-red">Sil</button>
                </div>
                {expanded && (
                  <div className="px-4 pb-4 pl-12 space-y-3">
                    {t.descr && <p className="text-sm text-ink-body">{t.descr}</p>}
                    <div className="flex gap-2">
                      {(["todo", "doing", "done"] as TaskStatus[]).map((opt) => {
                        const label = opt === "todo" ? "Başlanmadı" : opt === "doing" ? "Devam Ediyor" : "Tamamlandı";
                        const active = s === opt;
                        const col = opt === "done" ? GREEN : opt === "doing" ? AMBER : "#6b7280";
                        return <button key={opt} onClick={() => changeStatus(t.id, opt)} className="rounded-bosch border px-3 py-1.5 text-xs font-medium" style={{ borderColor: active ? col : "#e5e7eb", color: active ? col : "#6b7280", background: active ? col + "12" : "transparent" }}>{label}</button>;
                      })}
                    </div>
                    <textarea defaultValue={states[t.id]?.note ?? ""} onBlur={(e) => saveNote(t.id, e.target.value)} rows={2} placeholder="Not ekle…" className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-xs text-ink outline-none focus:border-bosch-blue" />
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
