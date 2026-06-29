import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getT } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { LangProvider } from "@/components/LangProvider";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import type { Market } from "@/lib/types";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const locale = getLocale();
  const dict = getDict(locale);
  const t = getT();

  let market: Market | null = null;
  if (profile.market_id) {
    const supabase = createClient();
    const { data } = await supabase
      .from("markets")
      .select("*")
      .eq("id", profile.market_id)
      .single();
    market = (data as Market) ?? null;
  }

  return (
    <LangProvider locale={locale} dict={dict}>
      <div className="min-h-screen flex flex-col bg-white">
        <div className="bosch-supergraphic" />
        <Header profile={profile} market={market} />
        <div className="flex flex-1">
          <Sidebar role={profile.role} />
          <main className="flex-1 min-w-0 px-6 py-6">{children}</main>
        </div>
        <footer className="border-t border-surface-border bg-white px-6 py-3 text-xs text-ink-body flex items-center justify-between">
          <span>{t("footer.copyright")}</span>
          <span>{t("footer.credit")}</span>
        </footer>
      </div>
    </LangProvider>
  );
}
