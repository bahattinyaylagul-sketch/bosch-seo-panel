import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SoonModule from "@/components/SoonModule";

export const dynamic = "force-dynamic";

export default async function CompetitorPage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  return (
    <SoonModule
      title="Rakip Analizi"
      description="Rakiplerle karşılaştırmalı SEO & içerik farkı."
      intro="Rakip analizi modülü, seçilen rakip sitelerle karşılaştırma yaparak eksik sayfaları, konuları, şemaları ve içerik farklarını ortaya koyar."
      features={[
        "Eksik sayfalar & konular",
        "Eksik yapısal veri (schema) farkı",
        "İç bağlantı yapısı karşılaştırması",
        "İçerik uzunluğu & başlık yapısı",
        "Semantik skor farkı",
        "İçerik tazeliği (freshness) karşılaştırması",
        "Eksik varlıklar (entities)",
        "Fırsat kelimeleri",
      ]}
      note="Rakip sitelerin taranması ve/veya paralı SEO indeksi (DataForSEO, Ahrefs) gerektirir."
    />
  );
}
