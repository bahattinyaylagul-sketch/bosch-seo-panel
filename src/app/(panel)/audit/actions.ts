"use server";

import { getProfile } from "@/lib/auth";

export interface AuditResult {
  finalUrl: string;
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  metrics: { key: string; value: string }[];
}

export async function auditSite(rawUrl: string): Promise<AuditResult> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") throw new Error("Yetkisiz");

  let url = (rawUrl || "").trim();
  if (!url) throw new Error("URL boş");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const params = new URLSearchParams({ url, strategy: "mobile" });
  ["performance", "seo", "accessibility", "best-practices"].forEach((c) => params.append("category", c));
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);

  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Analiz servisi hatası (${res.status})`);
  }
  const data = await res.json();
  const lr = data?.lighthouseResult;
  if (!lr) throw new Error("Sonuç alınamadı");

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

  return { finalUrl: lr.finalUrl ?? url, scores, metrics };
}
