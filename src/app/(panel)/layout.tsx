import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import type { Market } from "@/lib/types";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

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
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bosch-supergraphic" />
      <Header profile={profile} market={market} />
      <div className="flex flex-1">
        <Sidebar role={profile.role} />
        <main className="flex-1 min-w-0 px-6 py-6">{children}</main>
      </div>
      <footer className="border-t border-surface-border bg-white px-6 py-3 text-xs text-ink-body flex items-center justify-between">
        <span>© Bosch Sanayi ve Ticaret A.Ş</span>
        <span>NextCode Collective tarafından hazırlanmıştır</span>
      </footer>
    </div>
  );
}
