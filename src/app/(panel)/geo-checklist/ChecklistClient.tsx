"use client";

import { useEffect, useMemo, useState } from "react";
import { type Priority, type TaskStatus } from "@/lib/geo-checklist";
import { getTrackedSites, getSiteTasks, setCustomTaskStatus, setCustomTaskNote, deleteCustomTask, type TrackedSite, type CustomTask } from "./actions";
import { useT } from "@/components/LangProvider";

const RED = "#ED0007", AMBER = "#E88E00", GREEN = "#00884A";
const PRI: Record<Priority, { key: string; c: string }> = {
  critical: { key: "tt.pri.critical", c: RED }, high: { key: "tt.pri.high", c: AMBER }, medium: { key: "tt.pri.medium", c: "#007BC0" }, low: { key: "tt.pri.low", c: "#6b7280" },
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

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}

export default function ChecklistClient() {
  const t = useT();
  const [sites, setSites] = useState<TrackedSite[] | null>(null);
  const [site, setSite] = useState<TrackedSite | null>(null);
  const [tasks, setTasks] = useState<CustomTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [fPri, setFPri] = useState<string>("all");
  const [fStat, setFStat] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => { getTrackedSites().then(setSites).catch(() => setSites([])); }, []);

  async function openSite(s: TrackedSite) {
    setSite(s); setLoading(true); setOpen(null); setFPri("all"); setFStat("all"); setQ("");
    try { setTasks(await getSiteTasks(s.id)); } catch { setTasks([]); }
    finally { setLoading(false); }
  }
  function backToSites() { setSite(null); getTrackedSites().then(setSites).catch(() => {}); }

  async function changeStatus(id: string, s: TaskStatus) {
    setTasks((p) => p.map((x) => (x.id === id ? { ...x, status: s } : x)));
    await setCustomTaskStatus(id, s);
  }
  async function saveNote(id: string, note: string) {
    setTasks((p) => p.map((x) => (x.id === id ? { ...x, note } : x)));
    await setCustomTaskNote(id, note);
  }
  async function removeTask(id: string) {
    setTasks((p) => p.filter((x) => x.id !== id));
    await deleteCustomTask(id);
  }

  const PTS: Record<string, number> = { critical: 10, high: 8, medium: 6, low: 4 };
  const stats = useMemo(() => {
    let earned = 0, total = 0, done = 0, doing = 0, criticalPending = 0;
    for (const t of tasks) {
      const pts = PTS[t.priority] ?? 8; total += pts;
      if (t.status === "done") { earned += pts; done++; }
      else if (t.status === "doing") { earned += pts * 0.5; doing++; }
      if (t.priority === "critical" && t.status !== "done") criticalPending++;
    }
    return { earned: Math.round(earned), total, done, doing, criticalPending, count: tasks.length, pct: total ? Math.round((100 * earned) / total) : 0 };
  }, [tasks]);

  const visible = tasks.filter((tk) => {
    if (fPri !== "all" && tk.priority !== fPri) return false;
    if (fStat !== "all" && tk.status !== fStat) return false;
    if (q && !((tk.title + " " + (tk.descr ?? "")).toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  // ─────────────────── SİTE LİSTESİ (landing) ───────────────────
  if (!site) {
    return (
      <div>
        {sites === null && <div className="text-sm text-ink-body">{t("tt.loading")}</div>}
        {sites && sites.length === 0 && (
          <div className="border border-surface-border rounded-bosch p-8 text-center">
            <div className="text-sm font-medium text-ink mb-1">{t("tt.nosites.title")}</div>
            <div className="text-xs text-ink-body">{t("tt.nosites.desc")}</div>
          </div>
        )}
        {sites && sites.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map((s) => (
              <button key={s.id} onClick={() => openSite(s)} className="text-left border border-surface-border rounded-bosch p-5 hover:border-bosch-blue hover:shadow-sm transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <Ring value={s.pct} size={60} stroke={7} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{s.name || hostOf(s.url)}</div>
                    <div className="text-[11px] text-ink-body truncate">{hostOf(s.url)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-lg font-semibold text-ink">{s.total}</div><div className="text-[10px] text-ink-body">{t("tt.stat.total")}</div></div>
                  <div><div className="text-lg font-semibold text-bosch-green">{s.done}</div><div className="text-[10px] text-ink-body">{t("tt.stat.done")}</div></div>
                  <div><div className="text-lg font-semibold text-bosch-red">{s.criticalPending}</div><div className="text-[10px] text-ink-body">{t("tt.stat.critical")}</div></div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────── SİTE İÇİ GÖREVLER (drill-in) ───────────────────
  return (
    <div>
      <button onClick={backToSites} className="text-sm text-bosch-blue hover:underline font-medium mb-4">← {t("tt.back")}</button>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base font-semibold text-ink">{site.name || hostOf(site.url)}</span>
        <span className="text-xs text-ink-body">{hostOf(site.url)}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="border border-surface-border rounded-bosch p-4 flex items-center gap-3">
          <Ring value={stats.pct} />
          <div><div className="text-xs text-ink-body">{t("tt.progress")}</div><div className="text-[11px] text-ink-body/70 cursor-help" title={t("tt.points.help")}>{stats.earned} / {stats.total}</div></div>
        </div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">{t("tt.stat.total")}</div><div className="text-3xl font-semibold text-ink">{stats.count}</div></div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">{t("tt.stat.done")}</div><div className="text-3xl font-semibold text-bosch-green">{stats.done}</div></div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">{t("tt.stat.doing")}</div><div className="text-3xl font-semibold text-amber-600">{stats.doing}</div></div>
        <div className="border border-surface-border rounded-bosch p-4"><div className="text-xs text-ink-body mb-1">{t("tt.stat.critical")}</div><div className="text-3xl font-semibold text-bosch-red">{stats.criticalPending}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tt.search")} className="flex-1 min-w-[180px] rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue" />
        <select value={fPri} onChange={(e) => setFPri(e.target.value)} className="rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none">
          <option value="all">{t("tt.filter.allpri")}</option><option value="critical">{t("tt.pri.critical")}</option><option value="high">{t("tt.pri.high")}</option><option value="medium">{t("tt.pri.medium")}</option><option value="low">{t("tt.pri.low")}</option>
        </select>
        <select value={fStat} onChange={(e) => setFStat(e.target.value)} className="rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none">
          <option value="all">{t("tt.filter.allstat")}</option><option value="todo">{t("tt.status.todo")}</option><option value="doing">{t("tt.status.doing")}</option><option value="done">{t("tt.status.done")}</option>
        </select>
      </div>

      {loading && <div className="text-sm text-ink-body">{t("tt.loading")}</div>}
      {!loading && tasks.length === 0 && (
        <div className="border border-surface-border rounded-bosch p-8 text-center">
          <div className="text-sm font-medium text-ink mb-1">{t("tt.notasks.title")}</div>
          <div className="text-xs text-ink-body">{t("tt.notasks.desc")}</div>
        </div>
      )}
      {!loading && tasks.length > 0 && (
        <div className="border border-bosch-blue/30 rounded-bosch overflow-hidden">
          <div className="px-4 py-3 bg-bosch-blue/5 text-sm font-semibold text-ink flex items-center justify-between">
            <span>{t("tt.findings")}</span>
            <span className="text-xs font-normal text-ink-body">{visible.length} / {tasks.length}</span>
          </div>
          {visible.map((tk) => {
            const s = tk.status;
            const expanded = open === tk.id;
            const pri = PRI[(tk.priority as Priority)] ?? PRI.high;
            return (
              <div key={tk.id} className="border-t border-surface-border">
                <div className="w-full flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpen(expanded ? null : tk.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px]" style={{ background: s === "done" ? GREEN : s === "doing" ? AMBER : "transparent", border: s === "todo" ? "1px solid #d1d5db" : "none", color: "#fff" }}>{s === "done" ? "✓" : s === "doing" ? "…" : ""}</span>
                    <span className={`flex-1 truncate text-sm ${s === "done" ? "line-through text-ink-body" : "text-ink font-medium"}`}>{tk.title}</span>
                  </button>
                  <span className="rounded-bosch text-[11px] px-2 py-0.5 font-medium whitespace-nowrap" style={{ backgroundColor: pri.c + "1a", color: pri.c }}>{t(pri.key)}</span>
                  <button onClick={() => removeTask(tk.id)} className="text-xs text-ink-body/60 hover:text-bosch-red">{t("tt.delete")}</button>
                </div>
                {expanded && (
                  <div className="px-4 pb-4 pl-12 space-y-3">
                    {tk.descr && <p className="text-sm text-ink-body">{tk.descr}</p>}
                    <div className="flex gap-2">
                      {(["todo", "doing", "done"] as TaskStatus[]).map((opt) => {
                        const label = opt === "todo" ? t("tt.status.todo") : opt === "doing" ? t("tt.status.doing") : t("tt.status.done");
                        const active = s === opt;
                        const col = opt === "done" ? GREEN : opt === "doing" ? AMBER : "#6b7280";
                        return <button key={opt} onClick={() => changeStatus(tk.id, opt)} className="rounded-bosch border px-3 py-1.5 text-xs font-medium" style={{ borderColor: active ? col : "#e5e7eb", color: active ? col : "#6b7280", background: active ? col + "12" : "transparent" }}>{label}</button>;
                      })}
                    </div>
                    <textarea defaultValue={tk.note ?? ""} onBlur={(e) => saveNote(tk.id, e.target.value)} rows={2} placeholder={t("tt.note")} className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-xs text-ink outline-none focus:border-bosch-blue" />
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
