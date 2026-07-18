import { createClient } from "@/lib/supabase/server";
import { PageHeader, ExecBadge } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import type { Execution, Market } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const supabase = createClient();
  const { data: markets = [] } = await supabase.from("markets").select("*").in("code", ["tr", "en", "de"]).order("sort_order");
  const { data: executions = [] } = await supabase
    .from("executions")
    .select("*")
    .order("due_date", { ascending: true });

  const ms = markets as Market[];
  const ex = (executions as Execution[]).filter((e) => e.due_date);
  const marketCode = (id: string) => ms.find((m) => m.id === id)?.code ?? "—";
  const t = getT();

  return (
    <div>
      <PageHeader title={t("rm.title")} description={t("rm.desc")} />

      {ex.length === 0 ? (
        <p className="text-sm text-ink-body">{t("rm.empty")}</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-surface-border" />
          <div className="space-y-4">
            {ex.map((e) => {
              const dot =
                e.status === "done" ? "bg-bosch-green" : e.status === "in_progress" ? "bg-bosch-blue" : "bg-surface-border";
              return (
                <div key={e.id} className="relative">
                  <div className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full ${dot} border-2 border-white`} />
                  <div className="bg-surface-muted border border-surface-border rounded-bosch p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-ink">
                        <span className="font-medium">{t(`execType.${e.type}`)}</span>
                        <span className="text-ink-body"> · {e.description}</span>
                      </div>
                      <div className="text-xs text-ink-body mt-0.5">
                        {marketCode(e.market_id)} · {e.due_date}
                      </div>
                    </div>
                    <ExecBadge status={e.status} label={t(`execStatus.${e.status}`)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
