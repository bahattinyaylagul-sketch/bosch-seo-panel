import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getDict, isLocale, type Locale } from "./i18n";

// Sunucu tarafı: cookie'den aktif dili oku
export function getLocale(): Locale {
  const c = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
}

// Sunucu bileşenleri için çeviri fonksiyonu
export function getT() {
  const dict = getDict(getLocale());
  return (key: string) => dict[key] ?? key;
}
