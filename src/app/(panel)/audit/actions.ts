"use server";

import { getProfile } from "@/lib/auth";

export type CheckStatus = "pass" | "warn" | "fail";
export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface AuditData {
  finalUrl: string;
  perfScore: number | null;
  metrics: { key: string; value: string }[];
  opportunities: { title: string; value: string }[];
  seoChecks: Check[];
  geoChecks: Check[];
  crawlNote?: string;
}

export type AuditResponse = { ok: true; data: AuditData } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Lighthouse (PageSpeed) performans verisi ───────────────────────────────
async function fetchLighthouse(url: string): Promise<
  | { ok: true; finalUrl: string; perfScore: number | null; metrics: { key: string; value: string }[]; opportunities: { title: string; value: string }[] }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({ url, strategy: "mobile" });
  params.append("category", "performance");
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  const MAX = 3;
  let lastErr = "Analiz tamamlanamadı.";
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50000);
    try {
      const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);

      if ([429, 500, 502, 503].includes(res.status)) {
        lastErr = "Analiz servisi geçici olarak yoğun. Birkaç saniye sonra tekrar deneyin.";
        if (attempt < MAX) { await sleep(2000 * attempt); continue; }
        return { ok: false, error: lastErr };
      }
      if (!res.ok) return { ok: false, error: (data?.error?.message as string) || `Analiz servisi ${res.status} döndü.` };

      const lr = data?.lighthouseResult;
      if (!lr) { lastErr = data?.error?.message ?? "Sonuç alınamadı."; if (attempt < MAX) { await sleep(1500); continue; } return { ok: false, error: lastErr }; }
      if (lr.runtimeError?.message) { lastErr = "Sayfa analiz edilemedi: " + lr.runtimeError.message; if (attempt < MAX) { await sleep(1500); continue; } return { ok: false, error: lastErr }; }

      const A = lr.audits ?? {};
      const pick = (k: string) => (A[k]?.displayValue as string) ?? "—";
      const metrics = [
        { key: "LCP", value: pick("largest-contentful-paint") },
        { key: "CLS", value: pick("cumulative-layout-shift") },
        { key: "FCP", value: pick("first-contentful-paint") },
        { key: "TBT", value: pick("total-blocking-time") },
        { key: "Speed Index", value: pick("speed-index") },
      ];

      const opportunities = Object.values<any>(A)
        .filter((a) => a?.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) > 100)
        .sort((x, y) => (y.details.overallSavingsMs ?? 0) - (x.details.overallSavingsMs ?? 0))
        .slice(0, 7)
        .map((a) => ({
          title: a.title as string,
          value: (a.displayValue as string) || `${Math.round(a.details.overallSavingsMs)} ms kazanç`,
        }));

      return {
        ok: true,
        finalUrl: lr.finalUrl ?? url,
        perfScore: lr.categories?.performance?.score ?? null,
        metrics,
        opportunities,
      };
    } catch (e) {
      clearTimeout(timer);
      const isAbort = e instanceof Error && e.name === "AbortError";
      lastErr = isAbort ? "Analiz çok uzun sürdü (zaman aşımı)." : e instanceof Error ? e.message : "Bilinmeyen hata";
      if (attempt < MAX) { await sleep(1500); continue; }
      return { ok: false, error: lastErr + " Lütfen tekrar deneyin." };
    }
  }
  return { ok: false, error: lastErr };
}

// ── Kendi crawler'ımız: HTML çekip SEO + GEO sinyalleri ────────────────────
async function crawlSeoGeo(url: string): Promise<{ seo: Check[]; geo: Check[]; note?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BoschSEOPanel/1.0; +https://bosch-seo)" },
    });
    clearTimeout(timer);
    if (!res.ok) return { seo: [], geo: [], note: `Sayfa HTML'i alınamadı (${res.status}).` };
    const html = (await res.text()).slice(0, 800_000);

    const m1 = (re: RegExp) => { const m = html.match(re); return m ? m[1].trim() : null; };
    const has = (re: RegExp) => re.test(html);
    const count = (re: RegExp) => (html.match(re) || []).length;

    const title = m1(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const desc =
      m1(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      m1(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const hasCanonical = has(/<link[^>]+rel=["']canonical["']/i);
    const hasViewport = has(/<meta[^>]+name=["']viewport["']/i);
    const hasLang = has(/<html[^>]+lang=["'][^"']+["']/i);
    const noindex = has(/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i);
    const h1Count = count(/<h1[\s>]/gi);
    const hreflangCount = count(/hreflang=["'][^"']+["']/gi);
    const imgTotal = count(/<img[\s>]/gi);
    const imgNoAlt = count(/<img(?![^>]*\balt=)[^>]*>/gi);
    const jsonLd = count(/<script[^>]+type=["']application\/ld\+json["']/gi);
    const ogTitle = has(/property=["']og:title["']/i);
    const ogImage = has(/property=["']og:image["']/i);
    const twitter = has(/name=["']twitter:card["']/i);

    const seo: Check[] = [
      title
        ? { label: "Sayfa başlığı (title)", status: title.length >= 10 && title.length <= 65 ? "pass" : "warn", detail: `${title.length} karakter — "${title.slice(0, 60)}"` }
        : { label: "Sayfa başlığı (title)", status: "fail", detail: "Başlık etiketi bulunamadı" },
      desc
        ? { label: "Meta açıklama", status: desc.length >= 50 && desc.length <= 160 ? "pass" : "warn", detail: `${desc.length} karakter (ideal 50–160)` }
        : { label: "Meta açıklama", status: "fail", detail: "Meta description bulunamadı" },
      h1Count === 1
        ? { label: "H1 başlığı", status: "pass", detail: "Tek H1 (ideal)" }
        : h1Count === 0
          ? { label: "H1 başlığı", status: "fail", detail: "H1 bulunamadı" }
          : { label: "H1 başlığı", status: "warn", detail: `${h1Count} adet H1 (tek olması önerilir)` },
      { label: "Canonical etiketi", status: hasCanonical ? "pass" : "warn", detail: hasCanonical ? "Var" : "Yok — yinelenen içerik riski" },
      { label: "Mobil viewport", status: hasViewport ? "pass" : "fail", detail: hasViewport ? "Var" : "Yok" },
      { label: "Dil etiketi (html lang)", status: hasLang ? "pass" : "warn", detail: hasLang ? "Tanımlı" : "Tanımsız" },
      hreflangCount > 0
        ? { label: "hreflang (çok pazar/uluslararası)", status: "pass", detail: `${hreflangCount} alternatif dil/pazar bağlantısı` }
        : { label: "hreflang (çok pazar/uluslararası)", status: "warn", detail: "hreflang yok — pazarlar arası SEO zayıf" },
      imgTotal === 0 || imgNoAlt === 0
        ? { label: "Görsel alt metni", status: "pass", detail: imgTotal === 0 ? "Görsel yok" : `${imgTotal} görselin tümünde alt var` }
        : { label: "Görsel alt metni", status: "warn", detail: `${imgNoAlt}/${imgTotal} görselde alt metni eksik` },
      { label: "İndekslenebilirlik", status: noindex ? "fail" : "pass", detail: noindex ? "noindex! Arama motoru dizine almaz" : "Dizine alınabilir" },
    ];

    const geo: Check[] = [
      jsonLd > 0
        ? { label: "Yapısal veri (JSON-LD)", status: "pass", detail: `${jsonLd} şema bloğu — AI/zengin sonuçlar için hazır` }
        : { label: "Yapısal veri (JSON-LD)", status: "warn", detail: "Schema.org verisi yok — AI motorları içeriği zor anlar" },
      ogTitle && ogImage
        ? { label: "Open Graph (paylaşım/AI önizleme)", status: "pass", detail: "og:title + og:image var" }
        : ogTitle || ogImage
          ? { label: "Open Graph (paylaşım/AI önizleme)", status: "warn", detail: "Eksik: " + [!ogTitle && "og:title", !ogImage && "og:image"].filter(Boolean).join(", ") }
          : { label: "Open Graph (paylaşım/AI önizleme)", status: "fail", detail: "Open Graph etiketi yok" },
      { label: "Twitter/X kartı", status: twitter ? "pass" : "warn", detail: twitter ? "Var" : "Yok" },
    ];

    return { seo, geo };
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return { seo: [], geo: [], note: isAbort ? "SEO taraması zaman aşımına uğradı." : "SEO taraması yapılamadı." };
  }
}

export async function auditSite(rawUrl: string): Promise<AuditResponse> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };

  let url = (rawUrl || "").trim();
  if (!url) return { ok: false, error: "URL boş" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const [lh, crawl] = await Promise.all([fetchLighthouse(url), crawlSeoGeo(url)]);
  if (!lh.ok) return { ok: false, error: lh.error };

  return {
    ok: true,
    data: {
      finalUrl: lh.finalUrl,
      perfScore: lh.perfScore,
      metrics: lh.metrics,
      opportunities: lh.opportunities,
      seoChecks: crawl.seo,
      geoChecks: crawl.geo,
      crawlNote: crawl.note,
    },
  };
}
