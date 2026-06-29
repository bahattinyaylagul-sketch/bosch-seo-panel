"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="text-2xl font-semibold text-ink tracking-tight">BOSCH</div>
            <div className="mt-1 text-sm text-ink-body">
              NextCode × Bosch Aftermarket
            </div>
            <div className="mt-0.5 text-xs text-ink-body">Global SEO Paneli</div>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-surface-muted border border-surface-border rounded-bosch p-6 space-y-4"
          >
            <div>
              <label className="block text-sm text-ink-body mb-1">E-posta</label>
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
              <label className="block text-sm text-ink-body mb-1">Parola</label>
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
              {loading ? "Giriş yapılıyor…" : "Giriş yap"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-body">
            © Bosch Sanayi ve Ticaret A.Ş · NextCode Collective
          </p>
        </div>
      </div>
    </div>
  );
}
