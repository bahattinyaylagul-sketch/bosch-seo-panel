import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SoonModule from "@/components/SoonModule";

export const dynamic = "force-dynamic";

export default async function TopicalPage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  return (
    <SoonModule
      title="Topical Authority"
      description="Konu bazlı otorite ve içerik boşluğu analizi."
      intro="Topical authority modülü, sitenin bir konudaki kapsama gücünü ölçer; hangi alt konuların eksik olduğunu ve rakiplere göre nerede boşluk bulunduğunu AI ile haritalandırır."
      features={[
        "Topic map (konu haritası)",
        "Eksik konular (missing topics)",
        "Parent-child konu ilişkileri",
        "Destekleyici makale kapsamı",
        "Cluster gücü (cluster strength)",
        "Topical gap (içerik boşlukları)",
        "Rakip konu boşlukları",
        "Hub sayfa önerileri",
      ]}
      note="Site geneli içerik haritası + rakip verisi gerektirir. Faz 2'de crawler ve AI ile devreye alınır."
    />
  );
}
