"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "./LangProvider";

export default function SignOutButton() {
  const router = useRouter();
  const t = useT();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="text-xs text-ink-body hover:text-bosch-red transition-colors"
    >
      {t("common.signOut")}
    </button>
  );
}
