import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  const t = getT();

  return (
    <div>
      <PageHeader
        title={t("kw.title")}
        description={t("kw.desc")}
        action={
          <span className="rounded-bosch bg-surface-muted border border-surface-border px-2.5 py-1 text-xs text-ink-body">
            {t("badge.soon")}
          </span>
        }
      />
      <div className="bg-surface-muted border border-surface-border rounded-bosch p-6 max-w-2xl">
        <p className="text-sm text-ink-body leading-relaxed">{t("kw.body")}</p>
      </div>
    </div>
  );
}
