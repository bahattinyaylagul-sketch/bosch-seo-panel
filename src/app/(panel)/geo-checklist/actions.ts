"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { TaskStatus } from "@/lib/geo-checklist";

const PTS: Record<string, number> = { critical: 10, high: 8, medium: 6, low: 4 };

export interface TrackedSite {
  id: string;
  url: string;
  name: string | null;
  total: number;
  done: number;
  doing: number;
  criticalPending: number;
  pct: number;
}
export interface CustomTask {
  id: string;
  title: string;
  descr: string | null;
  priority: string;
  status: TaskStatus;
  note: string | null;
}

// ── Taranan siteler + görev sayaçları ──
export async function getTrackedSites(): Promise<TrackedSite[]> {
  const profile = await getProfile();
  if (!profile) return [];
  const supabase = createClient();
  const [{ data: sites }, { data: tasks }] = await Promise.all([
    supabase.from("audit_sites").select("id,url,name").order("created_at", { ascending: true }),
    supabase.from("geo_custom_task").select("site_id,priority,status"),
  ]);
  const rows = (sites ?? []) as { id: string; url: string; name: string | null }[];
  const byId: Record<string, { earned: number; total: number; done: number; doing: number; crit: number }> = {};
  (tasks ?? []).forEach((t: any) => {
    if (!t.site_id) return;
    const b = (byId[t.site_id] ??= { earned: 0, total: 0, done: 0, doing: 0, crit: 0 });
    const pts = PTS[t.priority] ?? 8;
    b.total += pts;
    if (t.status === "done") { b.earned += pts; b.done++; }
    else if (t.status === "doing") { b.earned += pts * 0.5; b.doing++; }
    if (t.priority === "critical" && t.status !== "done") b.crit++;
  });
  const counts: Record<string, number> = {};
  (tasks ?? []).forEach((t: any) => { if (t.site_id) counts[t.site_id] = (counts[t.site_id] ?? 0) + 1; });
  return rows.map((s) => {
    const b = byId[s.id];
    return {
      id: s.id,
      url: s.url,
      name: s.name,
      total: counts[s.id] ?? 0,
      done: b?.done ?? 0,
      doing: b?.doing ?? 0,
      criticalPending: b?.crit ?? 0,
      pct: b && b.total ? Math.round((100 * b.earned) / b.total) : 0,
    };
  });
}

// ── Bir sitenin görevleri ──
export async function getSiteTasks(siteId: string): Promise<CustomTask[]> {
  const profile = await getProfile();
  if (!profile || !siteId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("geo_custom_task")
    .select("id,title,descr,priority,status,note")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    descr: r.descr ?? null,
    priority: r.priority,
    status: (r.status as TaskStatus) ?? "todo",
    note: r.note ?? null,
  }));
}

export async function setCustomTaskStatus(taskId: string, status: TaskStatus): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  const supabase = createClient();
  const { error } = await supabase.from("geo_custom_task").update({ status }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setCustomTaskNote(taskId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  const supabase = createClient();
  const { error } = await supabase.from("geo_custom_task").update({ note: note.slice(0, 2000) }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addCustomTasks(siteId: string, items: { title: string; descr: string; priority: string }[]): Promise<{ ok: boolean; count: number; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, count: 0, error: "Yetkisiz" };
  if (!siteId) return { ok: false, count: 0, error: "Site seçili değil — önce siteyi Site Denetimi'nde ekleyin" };
  if (!items.length) return { ok: false, count: 0, error: "Aktarılacak sorun yok" };
  const supabase = createClient();
  // Aynı siteye tekrar aktarımda kopya olmasın: mevcut başlıkları çıkar
  const { data: existing } = await supabase.from("geo_custom_task").select("title").eq("site_id", siteId);
  const have = new Set((existing ?? []).map((r: any) => (r.title || "").toLowerCase()));
  const fresh = items.filter((it) => !have.has(it.title.toLowerCase()));
  if (!fresh.length) return { ok: true, count: 0 };
  const rows = fresh.slice(0, 200).map((it) => ({
    site_id: siteId,
    cat: "audit",
    title: it.title.slice(0, 200),
    descr: (it.descr || "").slice(0, 600),
    priority: it.priority,
    source: "audit",
    status: "todo",
  }));
  const { error } = await supabase.from("geo_custom_task").insert(rows);
  if (error) return { ok: false, count: 0, error: error.message };
  return { ok: true, count: rows.length };
}

export async function deleteCustomTask(id: string): Promise<{ ok: boolean }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false };
  const supabase = createClient();
  await supabase.from("geo_custom_task").delete().eq("id", id);
  return { ok: true };
}
