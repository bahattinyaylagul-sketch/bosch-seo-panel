import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import GuidelineEditor from "../GuidelineEditor";
import GuidelineMarketTranslations, { type GuidelinePanel } from "../GuidelineMarketTranslations";
import DeleteGuidelineButton from "../DeleteGuidelineButton";
import type { Guideline, GuidelineTranslation, Market } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GuidelineDetailPage({ params }: { params: { id: string } }) {
  const profile = await getProfile();
  const supabase = createClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("*")
    .eq("id", params.id)
    .single<Guideline>();
  if (!guideline) notFound();

  const { data: markets = [] } = await supabase.from("markets").select("*").order("sort_order");
  const targetMarkets = (markets as Market[]).filter((m) => !m.is_source);

  const { data: translations = [] } = await supabase
    .from("guideline_translations")
    .select("*")
    .eq("guideline_id", params.id);
  const tx = (translations ?? []) as GuidelineTranslation[];

  const isAdmin = profile?.role === "admin";
  const role = profile?.role ?? "viewer";
  const t = getT();
  const visibleMarkets = isAdmin
    ? targetMarkets
    : targetMarkets.filter((m) => m.id === profile?.market_id);

  const panels: GuidelinePanel[] = visibleMarkets.map((m) => ({
    market: m,
    translation: tx.find((x) => x.market_id === m.id) ?? null,
    canEdit: isAdmin || (role === "market_manager" && m.id === profile?.market_id),
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/guidelines" className="text-sm text-bosch-blue hover:underline">
          ← {t("nav.guidelines")}
        </Link>
        {isAdmin && <DeleteGuidelineButton id={guideline.id} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
            <span className="inline-block rounded-bosch bg-bosch-red px-1.5 py-0.5 text-xs text-white">TR</span>
            {t("gl.source")}
          </h2>
          <GuidelineEditor guideline={guideline} editable={isAdmin} />
        </div>

        <div>
          <GuidelineMarketTranslations panels={panels} guidelineId={guideline.id} canTranslate={isAdmin} />
        </div>
      </div>
    </div>
  );
}
