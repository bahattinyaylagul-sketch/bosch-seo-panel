import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SoonModule from "@/components/SoonModule";

export const dynamic = "force-dynamic";

export default async function RankTrackerPage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  return (
    <SoonModule
      title="Sıralama Takibi"
      description="Anahtar kelimelerin Google sıralamasını pazar (ülke) bazında günlük takip edin."
      intro="Sıralama Takibi modülü, Bosch'un hedef kelimelerinin masaüstü ve mobil Google sıralamalarını her pazar için günlük ölçer; yükselen/düşen kelimeleri ve rakip hareketlerini gösterir."
      features={[
        "Ülke/dil bazında günlük sıralama ölçümü",
        "Masaüstü & mobil ayrımı",
        "Yükselen / düşen kelimeler (trend)",
        "SERP özellikleri (AI Overview, öne çıkan snippet)",
        "Rakip sıralama karşılaştırması",
        "Kelime grupları / etiketleme",
        "Görünürlük skoru (share of voice)",
        "Haftalık e-posta özeti",
      ]}
      note="Bu modül yakında gelecek. Yayınlandığında pazar bazında kelime setleri tanımlayıp otomatik takip başlatabileceksiniz."
    />
  );
}
