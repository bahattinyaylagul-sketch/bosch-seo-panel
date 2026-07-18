import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";
import ChecklistClient from "./ChecklistClient";

export const dynamic = "force-dynamic";

export default async function GeoChecklistPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const t = getT();
  return (
    <div>
      <PageHeader title={t("tt.pagetitle")} description={t("tt.pagedesc")} />
      <ChecklistClient />
    </div>
  );
}
