"use server";

import { getProfile } from "@/lib/auth";

export interface AuditData {
  finalUrl: string;
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  metrics: { key: string; value: string }[];
}

export type AuditResponse = { ok: true; data: AuditData } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function auditSite(rawUrl: string): Promise<AuditResponse> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };

  let url = (rawUrl || "").trim();
  if (!url) return { ok: false, error: "URL boş" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const params = new URLSearchParams({ url, strategy: "mobile" });
  ["performance", "seo", "accessibility", "best-practices"].forEach((c) => params.append("category", c));
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  const MAX_ATTEMPTS = 3;
  let lastErr = "Analiz tamamlanamadı.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50000);
    try {
      const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);

      // Geçici servis hataları → tekrar dene
      if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503) {
        lastErr = "Analiz servisi geçici olarak yoğun. Birkaç saniye sonra tekrar deneyin.";
        if (attempt < MAX_ATTEMPTS) {
          await sleep(2000 * attempt);
          continue;
        }
        return { ok: false, error: lastErr };
      }

      if (!res.ok) {
        const apiMsg = data?.error?.message as string | undefined;
        return { ok: false, error: apiMsg || `Analiz servisi ${res.status} döndü.` };
      }

      const lr = data?.lighthouseResult;
      if (!lr) {
        lastErr = data?.error?.message ?? "Sonuç alınamadı.";
        if (attempt < MAX_ATTEMPTS) {
          await sleep(1500);
          continue;
        }
        return { ok: false, error: lastErr };
      }

      // Lighthouse sayfayı yükleyemediyse (yavaş/engelli) → tekrar dene
      if (lr.runtimeError?.message) {
        lastErr = "Sayfa analiz edilemedi: " + lr.runtimeError.message;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(1500);
          continue;
        }
        return { ok: false, error: lastErr };
      }

      const cat = lr.categories ?? {};
      const scores = {
        performance: cat.performance?.score ?? null,
        seo: cat.seo?.score ?? null,
        accessibility: cat.accessibility?.score ?? null,
        bestPractices: cat["best-practices"]?.score ?? null,
      };
      const A = lr.audits ?? {};
      const pick = (k: string) => (A[k]?.displayValue as string) ?? "—";
      const metrics = [
        { key: "LCP", value: pick("largest-contentful-paint") },
        { key: "CLS", value: pick("cumulative-layout-shift") },
        { key: "FCP", value: pick("first-contentful-paint") },
        { key: "TBT", value: pick("total-blocking-time") },
        { key: "Speed Index", value: pick("speed-index") },
      ];

      return { ok: true, data: { finalUrl: lr.finalUrl ?? url, scores, metrics } };
    } catch (e) {
      clearTimeout(timer);
      const isAbort = e instanceof Error && e.name === "AbortError";
      lastErr = isAbort
        ? "Analiz çok uzun sürdü (zaman aşımı)."
        : e instanceof Error
          ? e.message
          : "Bilinmeyen hata";
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1500);
        continue;
      }
      return { ok: false, error: lastErr + " Lütfen tekrar deneyin." };
    }
  }

  return { ok: false, error: lastErr };
}
