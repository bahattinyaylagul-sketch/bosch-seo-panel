"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { useLocale } from "./LangProvider";

export default function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  function change(next: Locale) {
    // 1 yıl geçerli cookie
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <select
      aria-label="Dil / Language"
      value={locale}
      onChange={(e) => change(e.target.value as Locale)}
      className="rounded-bosch border border-surface-border bg-white px-2 py-1 text-xs text-ink outline-none focus:border-bosch-blue cursor-pointer"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {l.toUpperCase()} · {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
