import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SoonModule from "@/components/SoonModule";

export const dynamic = "force-dynamic";

export default async function Ga4Page() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  return (
    <SoonModule
      title="Google Analytics 4 (GA4)"
      description="GA4 trafiğini SEO verisiyle birleştirin — oturum, dönüşüm ve kanal analizi."
      intro="GA4 modülü, Bosch'un Google Analytics 4 mülkü bağlandığında organik trafik, oturum, etkileşim ve dönüşüm verilerini panele taşır; Search Console ile birleştirerek 'sıralama → trafik → dönüşüm' hunisini tek ekranda gösterir."
      features={[
        "Organik oturum, kullanıcı ve etkileşim oranı",
        "Kanal bazlı trafik dağılımı",
        "Dönüşüm / hedef takibi (events)",
        "Açılış sayfası performansı",
        "Ülke / cihaz kırılımı",
        "GSC + GA4 birleşik huni (sıralama → trafik → dönüşüm)",
        "Dönem karşılaştırması (YoY / MoM)",
      ]}
      note="Bu modül yakında gelecek. Yayınlandığında Bosch'un GA4 mülkünü OAuth ile bağlayarak gerçek trafik verisini görebileceksiniz."
    />
  );
}
