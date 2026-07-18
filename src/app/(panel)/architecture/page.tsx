import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SoonModule from "@/components/SoonModule";

export const dynamic = "force-dynamic";

export default async function ArchitecturePage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  return (
    <SoonModule
      title="Site Mimarisi"
      description="Tüm siteyi tarayarak yapısal SEO haritası çıkarır."
      intro="Site mimarisi modülü, tüm siteyi tarayan bir crawler ile URL yapısını, kategori derinliğini ve iç bağlantı grafiğini analiz eder; siloların ve konu kümelerinin ne kadar güçlü olduğunu gösterir."
      features={[
        "URL yapısı & klasör hiyerarşisi",
        "Tıklama derinliği (click depth) haritası",
        "Silo / topical cluster analizi",
        "Hub & pillar sayfa tespiti",
        "Orphan (bağlantısız) sayfalar",
        "İç bağlantı gücü (Internal PageRank)",
        "Anchor text çeşitliliği",
        "Crawl budget dağılımı",
      ]}
      note="Bu modül tüm siteyi tarayan bir crawler altyapısı (kuyruk + worker + veritabanı) gerektirir. Onay sonrası devreye alınabilir."
    />
  );
}
