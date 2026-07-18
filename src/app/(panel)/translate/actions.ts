"use server";

import { getProfile } from "@/lib/auth";
import { translateText } from "@/lib/translate";
import { isLocale, type Locale } from "@/lib/i18n";

const LANG_NAME: Record<Locale, string> = {
  tr: "Turkish",
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
};

export type TranslateResponse = { ok: true; text: string } | { ok: false; error: string };

export async function translateFreeText(text: string, target: string): Promise<TranslateResponse> {
  try {
    const profile = await getProfile();
    if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
    if (!text.trim()) return { ok: false, error: "Boş metin" };
    const loc: Locale = isLocale(target) ? target : "en";
    const out = await translateText(text, loc, LANG_NAME[loc]);
    return { ok: true, text: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Çeviri sırasında hata oluştu" };
  }
}
