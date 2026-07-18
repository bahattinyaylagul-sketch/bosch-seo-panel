import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { getMarkets } from "./actions";
import ChecklistClient from "./ChecklistClient";

export const dynamic = "force-dynamic";

export default async function GeoChecklistPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const markets = await getMarkets();
  return (
    <div>
      <PageHeader title="SEO & GEO Görev Takibi" description="Site Denetimi'nde bulunan SEO / GEO / AI eksiklerini pazar (ülke) bazında iş takibi olarak yönetin — başlanmadı, devam ediyor, tamamlandı." />
      <ChecklistClient markets={markets} />
    </div>
  );
}
