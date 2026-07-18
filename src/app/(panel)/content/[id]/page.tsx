import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import SourceEditor from "./SourceEditor";
import MarketTranslations, { type MarketPanel } from "./MarketTranslations";
import DeleteContentButton from "./DeleteContentButton";
import type { Content, ContentTranslation, Market } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const profile = await getProfile();
  const supabase = createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", params.id)
    .single<Content>();
  if (!content) notFound();

  const { data: markets = [] } = await supabase.from("markets").select("*").in("code", ["tr", "en", "de"]).order("sort_order");
  const targetMarkets = (markets as Market[]).filter((m) => !m.is_source);

  // RLS sayesinde market_manager yalnızca kendi pazarının çevirisini görür.
  const { data: translations = [] } = await supabase
    .from("content_translations")
    .select("*")
    .eq("content_id", params.id);
  const tx = translations as ContentTranslation[];

  const isAdmin = profile?.role === "admin";
  const role = profile?.role ?? "viewer";
  const t = getT();

  // Hangi pazar panelleri gösterilecek?
  const visibleMarkets = isAdmin
    ? targetMarkets
    : targetMarkets.filter((m) => m.id === profile?.market_id);

  const panels: MarketPanel[] = visibleMarkets.map((m) => ({
    market: m,
    translation: tx.find((x) => x.market_id === m.id) ?? null,
    canEdit: isAdmin || (role === "market_manager" && m.id === profile?.market_id),
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/content" className="text-sm text-bosch-blue hover:underline">
          ← {t("nav.content")}
        </Link>
        {isAdmin && <DeleteContentButton id={content.id} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TR kaynak */}
        <div>
          <h2 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
            <span className="inline-block rounded-bosch bg-bosch-red px-1.5 py-0.5 text-xs text-white">TR</span>
            {t("content.source")}
          </h2>
          <SourceEditor content={content} editable={isAdmin} />
        </div>

        {/* Çeviriler — pazar seçici + seçili panel */}
        <div>
          <MarketTranslations panels={panels} contentId={content.id} canTranslate={isAdmin} />
        </div>
      </div>
    </div>
  );
}
