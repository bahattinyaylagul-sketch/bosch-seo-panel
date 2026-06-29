"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { translateDoc } from "@/lib/translate";
import type { Guideline, Market } from "@/lib/types";

export async function createGuideline(formData: FormData) {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Yetkisiz");
  const supabase = createClient();

  const { data, error } = await supabase
    .from("guidelines")
    .insert({
      title: String(formData.get("title") || "Yeni guideline"),
      category: String(formData.get("category") || ""),
      body: String(formData.get("body") || ""),
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: markets } = await supabase.from("markets").select("id").eq("is_source", false);
  if (markets?.length) {
    await supabase.from("guideline_translations").insert(
      markets.map((m: { id: string }) => ({ guideline_id: data!.id, market_id: m.id, status: "draft" }))
    );
  }
  revalidatePath("/guidelines");
  return data!.id as string;
}

export async function updateGuideline(id: string, formData: FormData) {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Yetkisiz");
  const supabase = createClient();
  const { error } = await supabase
    .from("guidelines")
    .update({
      title: String(formData.get("title") || ""),
      category: String(formData.get("category") || ""),
      body: String(formData.get("body") || ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/guidelines/${id}`);
  revalidatePath("/guidelines");
}

export async function translateGuidelineForMarket(guidelineId: string, marketId: string) {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Sadece admin çeviri başlatabilir");
  const supabase = createClient();

  const { data: g } = await supabase.from("guidelines").select("*").eq("id", guidelineId).single<Guideline>();
  const { data: market } = await supabase.from("markets").select("*").eq("id", marketId).single<Market>();
  if (!g || !market) throw new Error("Kayıt bulunamadı");

  const result = await translateDoc(g, market.locale, market.name);
  const { error } = await supabase
    .from("guideline_translations")
    .upsert(
      {
        guideline_id: guidelineId,
        market_id: marketId,
        title: result.title,
        body: result.body,
        status: "translated",
        translated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guideline_id,market_id" }
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/guidelines/${guidelineId}`);
  revalidatePath("/guidelines");
}

export async function saveGuidelineTranslation(translationId: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("guideline_translations")
    .update({
      title: String(formData.get("title") || ""),
      body: String(formData.get("body") || ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", translationId);
  if (error) throw new Error(error.message);
  revalidatePath("/guidelines");
}

export async function approveGuidelineTranslation(translationId: string) {
  const profile = await getProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("guideline_translations")
    .update({
      status: "approved",
      approved_by: profile?.id ?? null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", translationId);
  if (error) throw new Error(error.message);
  revalidatePath("/guidelines");
}
