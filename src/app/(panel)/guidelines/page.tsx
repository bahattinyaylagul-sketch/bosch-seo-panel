import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/ui";
import NewGuidelineButton from "./NewGuidelineButton";
import type { Guideline, Market } from "@/lib/types";

export const dynamic = "force-dynamic";

interface GTranslation {
  guideline_id: string;
  market_id: string;
  status: "draft" | "translated" | "approved";
}

export default async function GuidelinesPage() {
  const profile = await getProfile();
  const supabase = createClient();
  const { data: markets = [] } = await supabase.from("markets").select("*").order("sort_order");
  const { data: guidelines = [] } = await supabase
    .from("guidelines")
    .select("*")
    .order("updated_at", { ascending: false });
  const { data: translations = [] } = await supabase
    .from("guideline_translations")
    .select("guideline_id, market_id, status");

  const targetMarkets = (markets as Market[]).filter((m) => !m.is_source);
  const tx = translations as GTranslation[];
  const gl = (guidelines ?? []) as Guideline[];

  return (
    <div>
      <PageHeader
        title="Guideline"
        description="Teknik standart, schema kuralı, başlık prensibi, GEO metodu — pazarlara çevrilebilir dokümanlar."
        action={profile?.role === "admin" ? <NewGuidelineButton /> : undefined}
      />

      <div className="space-y-3">
        {gl.map((g) => {
          const gts = tx.filter((t) => t.guideline_id === g.id);
          return (
            <div key={g.id} className="bg-surface-muted border border-surface-border rounded-bosch p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/guidelines/${g.id}`} className="text-sm font-semibold text-ink hover:text-bosch-blue">
                    {g.title}
                  </Link>
                  {g.category && <p className="text-xs text-ink-body mt-0.5">{g.category}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {targetMarkets.map((m) => {
                    const t = gts.find((x) => x.market_id === m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-1">
                        <span className="text-xs text-ink-body">{m.code}</span>
                        {t ? <StatusBadge status={t.status} /> : <span className="text-xs text-ink-body">—</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {gl.length === 0 && (
          <p className="text-sm text-ink-body">Henüz guideline yok.</p>
        )}
      </div>
    </div>
  );
}
