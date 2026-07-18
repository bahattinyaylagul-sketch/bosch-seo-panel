"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { TaskStatus } from "@/lib/geo-checklist";

export interface MarketRow { id: string; code: string; name: string }
export interface TaskState { status: TaskStatus; note: string | null }

export async function getMarkets(): Promise<MarketRow[]> {
  const profile = await getProfile();
  if (!profile) return [];
  const supabase = createClient();
  const { data } = await supabase.from("markets").select("id,code,name").order("code", { ascending: true });
  return (data ?? []) as MarketRow[];
}

export async function getTaskStatuses(marketId: string): Promise<Record<string, TaskState>> {
  const profile = await getProfile();
  if (!profile || !marketId) return {};
  const supabase = createClient();
  const { data } = await supabase.from("geo_task_status").select("task_id,status,note").eq("market_id", marketId);
  const map: Record<string, TaskState> = {};
  (data ?? []).forEach((r: any) => { map[r.task_id] = { status: r.status as TaskStatus, note: r.note ?? null }; });
  return map;
}

export async function setTaskStatus(taskId: string, marketId: string, status: TaskStatus): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  if (!marketId) return { ok: false, error: "Pazar seçili değil" };
  const supabase = createClient();
  const { error } = await supabase.from("geo_task_status").upsert(
    { task_id: taskId, market_id: marketId, status, updated_at: new Date().toISOString() },
    { onConflict: "task_id,market_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setTaskNote(taskId: string, marketId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  if (!marketId) return { ok: false, error: "Pazar seçili değil" };
  const supabase = createClient();
  const { error } = await supabase.from("geo_task_status").upsert(
    { task_id: taskId, market_id: marketId, note: note.slice(0, 2000), updated_at: new Date().toISOString() },
    { onConflict: "task_id,market_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Denetimden eklenen özel görevler ──
export interface CustomTask { id: string; title: string; descr: string | null; priority: string }
export async function getCustomTasks(marketId: string): Promise<CustomTask[]> {
  const profile = await getProfile();
  if (!profile || !marketId) return [];
  const supabase = createClient();
  const { data } = await supabase.from("geo_custom_task").select("id,title,descr,priority").eq("market_id", marketId).order("created_at", { ascending: false });
  return (data ?? []) as CustomTask[];
}
export async function addCustomTasks(marketId: string, items: { title: string; descr: string; priority: string }[]): Promise<{ ok: boolean; count: number; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, count: 0, error: "Yetkisiz" };
  if (!marketId) return { ok: false, count: 0, error: "Pazar seçili değil" };
  if (!items.length) return { ok: false, count: 0, error: "Aktarılacak sorun yok" };
  const supabase = createClient();
  const rows = items.slice(0, 100).map((it) => ({ market_id: marketId, cat: "audit", title: it.title.slice(0, 200), descr: (it.descr || "").slice(0, 600), priority: it.priority, source: "audit" }));
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
