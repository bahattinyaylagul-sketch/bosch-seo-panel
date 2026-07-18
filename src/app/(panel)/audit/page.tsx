import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";
import AuditTool from "./AuditTool";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function AuditPage() {
  const profile = await getProfile();
  if (profile?.role === "viewer") redirect("/dashboard");
  const t = getT();

  return (
    <div>
      <PageHeader title={t("au.title")} description={t("au.desc")} />
      <AuditTool />
    </div>
  );
}
