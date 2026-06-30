"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  getDict,
  isLocale,
  type Locale,
} from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
    if (m && isLocale(m[1])) setLocale(m[1]);
  }, []);

  const dict = getDict(locale);
  const t = (k: string) => dict[k] ?? k;

  function changeLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setLocale(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bosch-supergraphic" />
      <div className="flex justify-end px-4 pt-3">
        <select
          aria-label="Dil / Language"
          value={locale}
          onChange={(e) => changeLocale(e.target.value as Locale)}
          className="rounded-bosch border border-surface-border bg-white px-2 py-1 text-xs text-ink outline-none focus:border-bosch-blue cursor-pointer"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()} · {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <img src="/bosch-logo.png" alt="BOSCH" className="h-9 w-auto mx-auto" />
            <div className="mt-3 text-sm text-ink-body">{t("panel.subtitle")}</div>
            <div className="mt-0.5 text-xs text-ink-body">{t("panel.name")}</div>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-surface-muted border border-surface-border rounded-bosch p-6 space-y-4"
          >
            <div>
              <label className="block text-sm text-ink-body mb-1">{t("login.email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue"
                placeholder="ad@nextcodecollective.com"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-body mb-1">{t("login.password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-bosch bg-bosch-red px-4 py-2.5 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60"
            >
              {loading ? t("login.signingIn") : t("login.signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-body">
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </div>
  );
}
