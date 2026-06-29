import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Sunucu tarafı: aktif kullanıcının profilini (rol + pazar) getirir.
export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, market_id")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}
