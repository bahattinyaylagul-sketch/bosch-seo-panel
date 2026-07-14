import SignOutButton from "./SignOutButton";
import LanguageSwitcher from "./LanguageSwitcher";
import { getT } from "@/lib/i18n-server";
import type { Profile, Market } from "@/lib/types";

export default function Header({
  profile,
  market,
}: {
  profile: Profile;
  market: Market | null;
}) {
  const t = getT();
  return (
    <header className="border-b border-surface-border bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo: public/bosch-logo.png (yoksa "BOSCH" alt metni görünür) */}
          <img src="/bosch-logo.png" alt="BOSCH" className="h-6 w-auto shrink-0" />
          <span className="hidden md:inline text-sm text-ink-body truncate">
            {t("panel.subtitle")} · {t("panel.name")}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <LanguageSwitcher />
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-sm text-ink truncate max-w-[200px]">{profile.full_name || profile.email}</div>
            <div className="text-xs text-ink-body">
              {t(`role.${profile.role}`)}
              {market ? ` · ${market.code}` : ""}
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
