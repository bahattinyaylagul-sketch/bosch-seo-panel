import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader, ExecBadge } from "@/components/ui";
import { EXEC_TYPE_LABELS_TR } from "@/lib/types";
import ExecutionManager from "./ExecutionManager";
import type { Execution, Market } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExecutionPage() {
  const profile = await getProfile();
  const supabase = createClient();
  const { data: markets = [] } = await supabase.from("markets").select("*").order("sort_order");
  const { data: executions = [] } = await supabase
    .from("executions")
    .select("*")
    .order("due_date", { ascending: true });

  const ms = markets as Market[];
  const ex = (executions ?? []) as Execution[];
  const isAdmin = profile?.role === "admin";

  return (
    <div>
      <PageHeader
        title="İş takibi"
        description="NextCode'un pazar bazında yürüttüğü işler: audit, schema, redirect, GEO, optimizasyon."
      />

      {isAdmin ? (
        <ExecutionManager markets={ms} executions={ex} />
      ) : (
        <div className="space-y-8">
          {ms.map((m) => {
            const items = ex.filter((e) => e.market_id === m.id);
            if (items.length === 0) return null;
            return (
              <div key={m.id}>
                <h2 className="text-sm font-semibold text-ink mb-2">
                  {m.code} · {m.name}
                </h2>
                <div className="border border-surface-border rounded-bosch overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-muted text-ink-body">
                      <tr>
                        <th className="text-left font-medium px-4 py-2.5">Tip</th>
                        <th className="text-left font-medium px-4 py-2.5">Açıklama</th>
                        <th className="text-left font-medium px-4 py-2.5">URL</th>
                        <th className="text-left font-medium px-4 py-2.5">Tarih</th>
                        <th className="text-left font-medium px-4 py-2.5">Statü</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((e) => (
                        <tr key={e.id} className="border-t border-surface-border">
                          <td className="px-4 py-3 text-ink">{EXEC_TYPE_LABELS_TR[e.type]}</td>
                          <td className="px-4 py-3 text-ink-body">{e.description}</td>
                          <td className="px-4 py-3 text-bosch-blue text-xs break-all">{e.urls}</td>
                          <td className="px-4 py-3 text-ink-body">{e.due_date ?? "—"}</td>
                          <td className="px-4 py-3">
                            <ExecBadge status={e.status} />
                            {e.output_file_url && (
                              <a href={e.output_file_url} target="_blank" rel="noreferrer" className="block text-xs text-bosch-blue hover:underline mt-1">
                                çıktı dosyası ↗
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {ex.length === 0 && <p className="text-sm text-ink-body">Henüz iş kaydı yok.</p>}
        </div>
      )}
    </div>
  );
}
