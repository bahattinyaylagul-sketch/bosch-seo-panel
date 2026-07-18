import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SoonModule from "@/components/SoonModule";

export const dynamic = "force-dynamic";

export default async function SearchConsolePage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  return (
    <SoonModule
      title="Search Console Analizi"
      description="Google Search Console verisiyle gerçek performans."
      intro="Search Console modülü, Bosch'un Google Search Console hesabı bağlandığında gerçek arama verisini panele taşır: tıklama, gösterim, sıralama ve fırsat kelimeleri."
      features={[
        "CTR, gösterim, tıklama, ortalama pozisyon",
        "Marka / marka dışı ayrımı",
        "Query cluster'ları",
        "Cannibalization (kelime çakışması)",
        "Düşüşteki sayfalar (decay)",
        "Kazananlar & kaybedenler",
        "Fırsat kelimeleri",
        "Düşük CTR sayfaları",
      ]}
      note="Bu modül ücretsizdir — yalnızca Bosch'un Google Search Console hesabını OAuth ile bağlaması yeterlidir. Bağlantı sonrası veriler gerçek zamanlı gelir."
    />
  );
}
