"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { translateContent } from "@/lib/translate";
import type { Content, ContentTranslation, Market } from "@/lib/types";

// ---- TR kaynak içerik oluştur (admin) -----------------------
export async function createContent(formData: FormData) {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Yetkisiz");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("contents")
    .insert({
      title: String(formData.get("title") || "Yeni içerik"),
      target_keyword: String(formData.get("target_keyword") || ""),
      slug: String(formData.get("slug") || ""),
      meta_title: String(formData.get("meta_title") || ""),
      meta_description: String(formData.get("meta_description") || ""),
      body: String(formData.get("body") || ""),
      schema_type: String(formData.get("schema_type") || "Article"),
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Kaynak olmayan her pazar için boş çeviri satırı aç
  const { data: markets } = await supabase
    .from("markets")
    .select("id")
    .eq("is_source", false);
  if (markets?.length) {
    await supabase.from("content_translations").insert(
      markets.map((m: { id: string }) => ({
        content_id: data!.id,
        market_id: m.id,
        status: "draft",
        needs_local_review: true,
      }))
    );
  }

  revalidatePath("/content");
  return data!.id as string;
}

// ---- TR kaynak güncelle (admin) -----------------------------
export async function updateContent(id: string, formData: FormData) {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Yetkisiz");

  const supabase = createClient();
  const { error } = await supabase
    .from("contents")
    .update({
      title: String(formData.get("title") || ""),
      target_keyword: String(formData.get("target_keyword") || ""),
      slug: String(formData.get("slug") || ""),
      meta_title: String(formData.get("meta_title") || ""),
      meta_description: String(formData.get("meta_description") || ""),
      body: String(formData.get("body") || ""),
      schema_type: String(formData.get("schema_type") || "Article"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
}

// ---- Çevir (admin): seçili pazara Anthropic ile çevir -------
export async function translateForMarket(contentId: string, marketId: string) {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Sadece admin çeviri başlatabilir");

  const supabase = createClient();
  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .single<Content>();
  const { data: market } = await supabase
    .from("markets")
    .select("*")
    .eq("id", marketId)
    .single<Market>();
  if (!content || !market) throw new Error("İçerik/pazar bulunamadı");

  const result = await translateContent(content, market.locale, market.name);

  // Upsert: kayıt yoksa oluştur (sonradan eklenen diller eski içeriklerde de çalışsın)
  const { error } = await supabase
    .from("content_translations")
    .upsert(
      {
        content_id: contentId,
        market_id: marketId,
        title: result.title,
        target_keyword: result.target_keyword,
        slug: result.slug,
        meta_title: result.meta_title,
        meta_description: result.meta_description,
        body: result.body,
        status: "translated",
        needs_local_review: true, // keyword & slug lokal düzenleme gerektirir
        translated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "content_id,market_id" }
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/content/${contentId}`);
  revalidatePath("/content");
}

// ---- Çeviriyi düzenle/kaydet (admin + ilgili market_manager) -
export async function saveTranslation(translationId: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("content_translations")
    .update({
      title: String(formData.get("title") || ""),
      target_keyword: String(formData.get("target_keyword") || ""),
      slug: String(formData.get("slug") || ""),
      meta_title: String(formData.get("meta_title") || ""),
      meta_description: String(formData.get("meta_description") || ""),
      body: String(formData.get("body") || ""),
      needs_local_review: false, // lokal düzenleme yapıldı
      updated_at: new Date().toISOString(),
    })
    .eq("id", translationId);
  if (error) throw new Error(error.message); // RLS yetkisizse burada hata döner
  revalidatePath("/content");
}

// ---- Çeviriyi onayla (admin + ilgili market_manager) --------
export async function approveTranslation(translationId: string) {
  const profile = await getProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("content_translations")
    .update({
      status: "approved",
      approved_by: profile?.id ?? null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", translationId);
  if (error) throw new Error(error.message);
  revalidatePath("/content");
  revalidatePath("/dashboard");
}
