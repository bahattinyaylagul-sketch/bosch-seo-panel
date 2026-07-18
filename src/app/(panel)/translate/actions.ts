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

export async function translateFreeText(text: string, target: string): Promise<string> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") throw new Error("Yetkisiz");
  if (!text.trim()) throw new Error("Boş metin");
  const loc: Locale = isLocale(target) ? target : "en";
  return translateText(text, loc, LANG_NAME[loc]);
}
