import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader, StatusBadge } from "@/components/ui";
import NewContentButton from "./NewContentButton";
import ContentFilters from "./ContentFilters";
import type { Content, ContentTranslation, Market, TranslationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContentListPage({
  searchParams,
}: {
  searchParams: { market?: string; status?: string };
}) {
  const profile = await getProfile();
  const supabase = createClient();

  const { data: markets = [] } = await supabase
    .from("markets")
    .select("*")
    .order("sort_order");
  const targetMarkets = (markets as Market[]).filter((m) => !m.is_source);

  const { data: contents = [] } = await supabase
    .from("contents")
    .select("*")
    .order("updated_at", { ascending: false });

  const { data: translations = [] } = await supabase
    .from("content_translations")
    .select("*");

  const tx = translations as ContentTranslation[];
  const byContent = new Map<string, ContentTranslation[]>();
  for (const t of tx) {
    const arr = byContent.get(t.content_id) ?? [];
    arr.push(t);
    byContent.set(t.content_id, arr);
  }

  const marketFilter = searchParams.market || "";
  const statusFilter = (searchParams.status || "") as TranslationStatus | "";

  const rows = (contents as Content[]).filter((c) => {
    if (!marketFilter && !statusFilter) return true;
    const ts = byContent.get(c.id) ?? [];
    return ts.some(
      (t) =>
        (!marketFilter || t.market_id === marketFilter) &&
        (!statusFilter || t.status === statusFilter)
    );
  });

  const isAdmin = profile?.role === "admin";

  return (
    <div>
      <PageHeader
        title="İçerik kütüphanesi"
        description="TR kaynak içerikler ve pazar bazında çeviri durumları."
        action={isAdmin ? <NewContentButton /> : undefined}
      />

      <ContentFilters markets={targetMarkets} />

      <div className="border border-surface-border rounded-bosch overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-ink-body">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Başlık</th>
              <th className="text-left font-medium px-4 py-2.5">Keyword</th>
              <th className="text-left font-medium px-4 py-2.5">Schema</th>
              {targetMarkets.map((m) => (
                <th key={m.id} className="text-left font-medium px-4 py-2.5">
                  {m.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const ts = byContent.get(c.id) ?? [];
              return (
                <tr key={c.id} className="border-t border-surface-border hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/content/${c.id}`} className="text-ink hover:text-bosch-blue font-medium">
                      {c.title}
                    </Link>
                    <div className="text-xs text-ink-body">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-body">{c.target_keyword}</td>
                  <td className="px-4 py-3 text-ink-body">{c.schema_type}</td>
                  {targetMarkets.map((m) => {
                    const t = ts.find((x) => x.market_id === m.id);
                    return (
                      <td key={m.id} className="px-4 py-3">
                        {t ? <StatusBadge status={t.status} /> : <span className="text-xs text-ink-body">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + targetMarkets.length} className="px-4 py-8 text-center text-ink-body">
                  Kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
