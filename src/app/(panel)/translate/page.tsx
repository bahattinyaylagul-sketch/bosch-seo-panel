import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";
import TranslateTool from "./TranslateTool";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TranslatePage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  const t = getT();

  return (
    <div>
      <PageHeader title={t("tr.title")} description={t("tr.desc")} />
      <TranslateTool />
    </div>
  );
}
