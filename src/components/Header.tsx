import SignOutButton from "./SignOutButton";
import { ROLE_LABELS_TR, type Profile, type Market } from "@/lib/types";

export default function Header({
  profile,
  market,
}: {
  profile: Profile;
  market: Market | null;
}) {
  return (
    <header className="border-b border-surface-border bg-white">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight text-ink">BOSCH</span>
          <span className="hidden sm:inline text-sm text-ink-body">
            NextCode × Bosch Aftermarket · Global SEO Paneli
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <div className="text-sm text-ink">{profile.full_name || profile.email}</div>
            <div className="text-xs text-ink-body">
              {ROLE_LABELS_TR[profile.role]}
              {market ? ` · ${market.code}` : ""}
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
