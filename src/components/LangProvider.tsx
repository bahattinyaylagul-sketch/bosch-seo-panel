"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Dict, type Locale } from "@/lib/i18n";

const Ctx = createContext<{ locale: Locale; dict: Dict }>({ locale: DEFAULT_LOCALE, dict: {} });

export function LangProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ locale, dict }}>{children}</Ctx.Provider>;
}

// Client bileşenleri için çeviri fonksiyonu
export function useT() {
  const { dict } = useContext(Ctx);
  return (key: string) => dict[key] ?? key;
}

export function useLocale() {
  return useContext(Ctx).locale;
}
