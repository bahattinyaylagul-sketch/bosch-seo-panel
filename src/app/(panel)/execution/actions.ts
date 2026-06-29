"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const BUCKET = "execution-outputs";

async function requireAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Sadece admin iş düzenleyebilir");
  return profile;
}

export async function createExecution(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("executions").insert({
    market_id: String(formData.get("market_id")),
    type: String(formData.get("type")),
    description: String(formData.get("description") || ""),
    urls: String(formData.get("urls") || ""),
    status: String(formData.get("status") || "todo"),
    due_date: (formData.get("due_date") as string) || null,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/execution");
  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
}

export async function updateExecution(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("executions")
    .update({
      type: String(formData.get("type")),
      description: String(formData.get("description") || ""),
      urls: String(formData.get("urls") || ""),
      status: String(formData.get("status") || "todo"),
      due_date: (formData.get("due_date") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/execution");
  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
}

export async function deleteExecution(id: string) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("executions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/execution");
  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
}

export async function uploadExecutionFile(id: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${id}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (upErr) throw new Error(`Yükleme hatası: ${upErr.message}`);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase
    .from("executions")
    .update({ output_file_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/execution");
}
