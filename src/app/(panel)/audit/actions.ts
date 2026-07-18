"use server";

import { getProfile } from "@/lib/auth";
import { analyzeContentAI, type AiAnalysis } from "@/lib/audit-ai";

export type CheckStatus = "pass" | "warn" | "fail";
export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
  urls?: string[]; // etkilenen sayfalar (site geneli taramada)
}

// Kontrol başlığına göre "öneri / nasıl düzeltilir" metni (satır açılınca gösterilir)
const FIX: Record<string, string> = {
  "Sunucu yanıt süresi (TTFB)": "Sunucu/CDN önbelleğini iyileştirin, TTFB'yi 800 ms altına indirin.",
  "Sıkıştırma (gzip/brotli)": "Sunucuda Brotli veya Gzip sıkıştırmayı etkinleştirin; sayfa boyutu belirgin düşer.",
  "HTML boyutu": "Satır içi (inline) fazla kodu ve gereksiz veriyi azaltın; HTML'i sadeleştirin.",
  "HSTS güvenlik başlığı": "Strict-Transport-Security başlığı ekleyerek HTTPS'i zorunlu kılın.",
  "X-Content-Type-Options": "X-Content-Type-Options: nosniff başlığı ekleyin (MIME-sniffing koruması).",
  "İndekslenebilirlik": "Sayfa dizine alınmalıysa <meta name=robots content=noindex> etiketini kaldırın.",
  "Canonical etiketi": "Her sayfaya kendine işaret eden (self-referencing) bir canonical ekleyin.",
  "robots.txt": "Kök dizine robots.txt ekleyin ve içinde Sitemap satırı tanımlayın.",
  "XML Sitemap": "XML sitemap oluşturup robots.txt'te belirtin ve Search Console'a gönderin.",
  "Sayfa başlığı (title)": "Başlığı 10–60 karakter tutun; ana anahtar kelimeyi başa, markayı sona alın.",
  "Meta açıklama": "50–160 karakter, tıklamayı teşvik eden (CTA içeren) benzersiz bir meta açıklama yazın.",
  "H1 başlığı": "Sayfada tek bir H1 kullanın ve ana anahtar kelimeyi içersin.",
  "Başlık hiyerarşisi (H2+)": "İçeriği H2/H3 alt başlıklarla bölerek mantıksal bir hiyerarşi kurun.",
  "İçerik uzunluğu": "İçeriği en az 300+ kelimeye çıkararak konuyu kapsamlı işleyin.",
  "Görsel alt metni": "Alt metni eksik anlamlı görsellere açıklayıcı alt metni ekleyin.",
  "İç bağlantılar": "İlgili sayfalara bağlam içeren (contextual) iç bağlantılar ekleyin.",
  "Dil etiketi (html lang)": "<html lang=\"tr\"> gibi bir dil etiketi tanımlayın.",
  "hreflang (çok pazar/uluslararası)": "Diller/pazarlar arası hreflang etiketleri ekleyin — Bosch'un çok pazarlı yapısı için kritik.",
  "Mobil viewport": "<meta name=viewport content=\"width=device-width, initial-scale=1\"> ekleyin.",
  "Alt metni kapsamı": "Alt metni olmayan görsellere kısa, açıklayıcı alt metni ekleyin.",
  "Modern format (WebP/AVIF)": "Görselleri WebP/AVIF formatında sunarak dosya boyutunu düşürün.",
  "Lazy loading": "Ekran dışı görsellere loading=\"lazy\" ekleyin; ilk yük hızlanır.",
  "Boyut tanımı (CLS)": "Görsellere width/height verin veya aspect-ratio kullanın; düzen kaymasını (CLS) önler.",
  "Responsive viewport": "width=device-width içeren viewport meta etiketi ekleyin.",
  "Tema rengi (theme-color)": "<meta name=theme-color> etiketi ekleyin.",
  "Dokunmatik ikon / favicon": "apple-touch-icon ve favicon tanımlayın.",
  "Yapısal veri (JSON-LD)": "Schema.org JSON-LD ekleyin (Organization, Product, BreadcrumbList, FAQ). AI motorları için kritik.",
  "Kurum şeması (Organization)": "Organization/LocalBusiness şeması ekleyerek marka varlığını (entity) netleştirin.",
  "Ürün şeması (Product/Offer)": "Ürün sayfalarına Product + Offer şeması ekleyin (fiyat, stok, puan).",
  "Breadcrumb şeması": "BreadcrumbList şeması ekleyerek gezinme yolunu tanımlayın.",
  "SSS / Soru-Cevap şeması": "Sık sorulan sorular için FAQPage şeması ekleyin — AI cevaplarında öne çıkarır.",
  "Open Graph (paylaşım/AI önizleme)": "og:title, og:description ve og:image etiketlerini tamamlayın.",
  "Twitter/X kartı": "twitter:card (ve ilgili) meta etiketlerini ekleyin.",
  "İçerik derinliği (AI için)": "İçeriği 600+ kelimeye çıkararak AI motorlarının alıntılayabileceği derinlik sağlayın.",
  "Yinelenen başlıklar (title)": "Aynı başlığı taşıyan sayfalara benzersiz title verin.",
  "Yinelenen meta açıklamalar": "Aynı meta açıklamayı taşıyan sayfalara benzersiz açıklama yazın.",
  "Eksik başlık": "Başlığı olmayan sayfalara title etiketi ekleyin.",
  "Eksik meta açıklama": "Meta açıklaması olmayan sayfalara ekleyin.",
  "Performans skoru (Lighthouse)": "Aşağıdaki hız fırsatlarını uygulayın: kullanılmayan JS/CSS, görsel optimizasyonu, render-blocking.",
  "LCP": "En büyük içerik ögesini hızlandırın: görsel optimizasyonu, sunucu yanıtı, render-blocking kaldırma.",
  "CLS": "Görsel/reklam alanlarına sabit boyut verin; geç yüklenen içeriğin sayfayı kaydırmasını önleyin.",
  "FCP": "Kritik CSS'i satır içi yapın, render-blocking kaynakları azaltın.",
  "TBT": "Uzun JavaScript görevlerini bölün, kullanılmayan JS'i kaldırın.",
  "Speed Index": "Sayfanın görünür kısmının daha erken çizilmesini sağlayın.",
};
export interface CheckGroup {
  id: string;
  title: string;
  checks: Check[];
}
export interface AuditData {
  finalUrl: string;
  health: number;
  counts: { errors: number; warnings: number; passes: number };
  perfScore: number | null;
  metrics: { key: string; value: string; status: CheckStatus }[];
  opportunities: { title: string; value: string }[];
  groups: CheckGroup[];
  ai: AiAnalysis | null;
}
export type AuditResponse = { ok: true; data: AuditData } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (compatible; BoschSEOPanel/1.0; +https://bosch-seo)";

function scoreToStatus(s: number | null | undefined): CheckStatus {
  if (s == null) return "warn";
  return s >= 0.9 ? "pass" : s >= 0.5 ? "warn" : "fail";
}

// Lighthouse "opportunity" audit id → Türkçe başlık
const OPP_TR: Record<string, string> = {
  "unused-javascript": "Kullanılmayan JavaScript'i azalt",
  "unused-css-rules": "Kullanılmayan CSS'i azalt",
  "render-blocking-resources": "Render engelleyen kaynakları kaldır",
  "unminified-javascript": "JavaScript'i küçült (minify)",
  "unminified-css": "CSS'i küçült (minify)",
  "modern-image-formats": "Görselleri modern formatta sun (WebP/AVIF)",
  "uses-webp-images": "Görselleri modern formatta sun (WebP/AVIF)",
  "uses-optimized-images": "Görselleri optimize et (sıkıştır)",
  "uses-responsive-images": "Uygun boyutlu görsel sun",
  "offscreen-images": "Ekran dışı görselleri ertele (lazy load)",
  "uses-text-compression": "Metin sıkıştırmayı etkinleştir (gzip/brotli)",
  "server-response-time": "Sunucu yanıt süresini kısalt (TTFB)",
  "redirects": "Gereksiz yönlendirmeleri azalt",
  "uses-long-cache-ttl": "Statik varlıklara uzun önbellek süresi ver",
  "total-byte-weight": "Toplam sayfa boyutunu azalt",
  "dom-size": "DOM boyutunu küçült",
  "duplicated-javascript": "Yinelenen JavaScript'i kaldır",
  "legacy-javascript": "Eski (legacy) JavaScript'i kaldır",
  "prioritize-lcp-image": "LCP görselini önceliklendir",
  "efficient-animated-content": "Animasyonlu içeriği video olarak sun",
};

// ── Lighthouse (PageSpeed) ─────────────────────────────────────────────────
type LhOk = {
  ok: true;
  finalUrl: string;
  perfScore: number | null;
  metrics: { key: string; value: string; status: CheckStatus }[];
  opportunities: { title: string; value: string }[];
};
async function fetchLighthouse(url: string): Promise<LhOk | { ok: false; error: string }> {
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
      const cell = (k: string) => ({ value: (A[k]?.displayValue as string) ?? "—", status: scoreToStatus(A[k]?.score) });
      const metrics = [
        { key: "LCP", ...cell("largest-contentful-paint") },
        { key: "CLS", ...cell("cumulative-layout-shift") },
        { key: "FCP", ...cell("first-contentful-paint") },
        { key: "TBT", ...cell("total-blocking-time") },
        { key: "Speed Index", ...cell("speed-index") },
      ];
      const opportunities = Object.entries<any>(A)
        .filter(([, a]) => a?.details?.type === "opportunity" && ((a.details.overallSavingsMs ?? 0) > 100 || (a.details.overallSavingsBytes ?? 0) > 10240))
        .sort(([, x], [, y]) => (y.details.overallSavingsMs ?? 0) - (x.details.overallSavingsMs ?? 0))
        .slice(0, 8)
        .map(([id, a]) => {
          const kb = a.details.overallSavingsBytes ? Math.round(a.details.overallSavingsBytes / 1024) : null;
          const ms = a.details.overallSavingsMs ? Math.round(a.details.overallSavingsMs) : null;
          const value = kb ? `~${kb} KB tasarruf` : ms ? `~${ms} ms tasarruf` : "";
          return { title: OPP_TR[id] ?? (a.title as string), value };
        });

      return { ok: true, finalUrl: lr.finalUrl ?? url, perfScore: lr.categories?.performance?.score ?? null, metrics, opportunities };
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

async function safeFetchText(u: string, ms: number): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(u, { cache: "no-store", signal: c.signal, headers: { "User-Agent": UA } });
    clearTimeout(t);
    const text = r.ok ? (await r.text()).slice(0, 300_000) : "";
    return { ok: r.ok, status: r.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

// ── Kendi crawler'ımız: teknik + on-page + GEO ─────────────────────────────
interface CrawlResult {
  groups: CheckGroup[];
  pageText: string;
  title: string;
  desc: string;
  origin: string;
}
async function crawl(inputUrl: string): Promise<CrawlResult> {
  const tech: Check[] = [];
  const onpage: Check[] = [];
  const geo: Check[] = [];
  const images: Check[] = [];
  const mobile: Check[] = [];

  let finalUrl = inputUrl;
  let html = "";
  let headers: Headers | null = null;
  let ttfb = 0;
  let status = 0;

  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 15000);
    const t0 = Date.now();
    const res = await fetch(inputUrl, { cache: "no-store", redirect: "follow", signal: c.signal, headers: { "User-Agent": UA } });
    ttfb = Date.now() - t0;
    clearTimeout(t);
    status = res.status;
    finalUrl = res.url || inputUrl;
    headers = res.headers;
    html = (await res.text()).slice(0, 1_200_000);
  } catch {
    tech.push({ label: "Sayfa erişimi", status: "fail", detail: "Sayfa HTML'i alınamadı (zaman aşımı veya engel)." });
    return { groups: [{ id: "tech", title: "Teknik SEO & Taranabilirlik", checks: tech }], pageText: "", title: "", desc: "", origin: "" };
  }

  const origin = (() => { try { return new URL(finalUrl).origin; } catch { return ""; } })();
  const host = (() => { try { return new URL(finalUrl).host; } catch { return ""; } })();
  const has = (re: RegExp) => re.test(html);
  const m1 = (re: RegExp) => { const m = html.match(re); return m ? m[1].trim() : null; };
  const count = (re: RegExp) => (html.match(re) || []).length;
  const h = (k: string) => headers?.get(k) ?? null;

  // ── Teknik SEO & taranabilirlik ──
  tech.push({ label: "HTTP durumu", status: status >= 200 && status < 300 ? "pass" : "fail", detail: `${status}` });
  tech.push(
    finalUrl.startsWith("https://")
      ? { label: "HTTPS (güvenli bağlantı)", status: "pass", detail: "Sertifikalı bağlantı" }
      : { label: "HTTPS (güvenli bağlantı)", status: "fail", detail: "Site HTTPS değil" }
  );
  tech.push(
    ttfb < 800
      ? { label: "Sunucu yanıt süresi (TTFB)", status: "pass", detail: `${ttfb} ms` }
      : ttfb < 1800
        ? { label: "Sunucu yanıt süresi (TTFB)", status: "warn", detail: `${ttfb} ms (yavaş)` }
        : { label: "Sunucu yanıt süresi (TTFB)", status: "fail", detail: `${ttfb} ms (çok yavaş)` }
  );
  const enc = h("content-encoding");
  tech.push(enc && /gzip|br|deflate/i.test(enc)
    ? { label: "Sıkıştırma (gzip/brotli)", status: "pass", detail: enc }
    : { label: "Sıkıştırma (gzip/brotli)", status: "warn", detail: "Sıkıştırma başlığı yok — sayfa boyutu büyür" });
  const htmlKB = Math.round(new TextEncoder().encode(html).length / 1024);
  tech.push(htmlKB < 200
    ? { label: "HTML boyutu", status: "pass", detail: `${htmlKB} KB` }
    : htmlKB < 500
      ? { label: "HTML boyutu", status: "warn", detail: `${htmlKB} KB (büyük)` }
      : { label: "HTML boyutu", status: "fail", detail: `${htmlKB} KB (çok büyük)` });
  tech.push(h("strict-transport-security")
    ? { label: "HSTS güvenlik başlığı", status: "pass", detail: "Var" }
    : { label: "HSTS güvenlik başlığı", status: "warn", detail: "Yok" });
  tech.push(h("x-content-type-options")
    ? { label: "X-Content-Type-Options", status: "pass", detail: h("x-content-type-options")! }
    : { label: "X-Content-Type-Options", status: "warn", detail: "Yok (MIME-sniffing koruması yok)" });
  const noindex = has(/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i);
  tech.push(noindex
    ? { label: "İndekslenebilirlik", status: "fail", detail: "noindex! Arama motoru dizine almaz" }
    : { label: "İndekslenebilirlik", status: "pass", detail: "Dizine alınabilir" });
  const canonical = m1(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  tech.push(canonical
    ? { label: "Canonical etiketi", status: "pass", detail: canonical.length > 70 ? canonical.slice(0, 67) + "…" : canonical }
    : { label: "Canonical etiketi", status: "warn", detail: "Yok — yinelenen içerik riski" });

  // robots.txt & sitemap
  if (origin) {
    const robots = await safeFetchText(origin + "/robots.txt", 8000);
    if (robots.ok) {
      tech.push({ label: "robots.txt", status: "pass", detail: "Mevcut" });
      const sm = robots.text.match(/sitemap:\s*(\S+)/i);
      if (sm) tech.push({ label: "XML Sitemap", status: "pass", detail: "robots.txt içinde tanımlı" });
      else {
        const smf = await safeFetchText(origin + "/sitemap.xml", 8000);
        tech.push(smf.ok
          ? { label: "XML Sitemap", status: "pass", detail: "/sitemap.xml mevcut" }
          : { label: "XML Sitemap", status: "warn", detail: "Sitemap bulunamadı" });
      }
    } else {
      tech.push({ label: "robots.txt", status: "warn", detail: "Bulunamadı" });
    }
  }

  // ── Sayfa içi SEO ──
  const title = m1(/<title[^>]*>([\s\S]*?)<\/title>/i);
  onpage.push(title
    ? { label: "Sayfa başlığı (title)", status: title.length >= 10 && title.length <= 60 ? "pass" : "warn", detail: `${title.length} karakter${title.length > 60 ? " (çok uzun, kesilebilir)" : title.length < 10 ? " (çok kısa)" : ""} — "${title.slice(0, 55)}"` }
    : { label: "Sayfa başlığı (title)", status: "fail", detail: "Başlık etiketi yok" });
  const desc = m1(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || m1(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  onpage.push(desc
    ? { label: "Meta açıklama", status: desc.length >= 50 && desc.length <= 160 ? "pass" : "warn", detail: `${desc.length} karakter (ideal 50–160)` }
    : { label: "Meta açıklama", status: "fail", detail: "Meta description yok" });
  const h1 = count(/<h1[\s>]/gi);
  onpage.push(h1 === 1
    ? { label: "H1 başlığı", status: "pass", detail: "Tek H1 (ideal)" }
    : h1 === 0
      ? { label: "H1 başlığı", status: "fail", detail: "H1 bulunamadı" }
      : { label: "H1 başlığı", status: "warn", detail: `${h1} adet H1 (tek olmalı)` });
  const h2 = count(/<h2[\s>]/gi);
  onpage.push(h2 > 0
    ? { label: "Başlık hiyerarşisi (H2+)", status: "pass", detail: `${h2} adet H2` }
    : { label: "Başlık hiyerarşisi (H2+)", status: "warn", detail: "Alt başlık (H2) yok" });
  // içerik uzunluğu
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  onpage.push(words >= 300
    ? { label: "İçerik uzunluğu", status: "pass", detail: `~${words} kelime` }
    : words >= 100
      ? { label: "İçerik uzunluğu", status: "warn", detail: `~${words} kelime (zayıf içerik)` }
      : { label: "İçerik uzunluğu", status: "fail", detail: `~${words} kelime (çok az)` });
  // görsel alt
  const imgTotal = count(/<img[\s>]/gi);
  const imgNoAlt = count(/<img(?![^>]*\balt=)[^>]*>/gi);
  onpage.push(imgTotal === 0 || imgNoAlt === 0
    ? { label: "Görsel alt metni", status: "pass", detail: imgTotal === 0 ? "Görsel yok" : `${imgTotal} görselin tümünde alt var` }
    : { label: "Görsel alt metni", status: imgNoAlt / imgTotal > 0.3 ? "fail" : "warn", detail: `${imgNoAlt}/${imgTotal} görselde alt metni eksik` });
  // linkler
  const hrefs = Array.from(html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)).map((m) => m[1]);
  let internal = 0, external = 0;
  for (const href of hrefs) {
    if (/^https?:\/\//i.test(href)) { try { new URL(href).host === host ? internal++ : external++; } catch {} }
    else if (href.startsWith("/")) internal++;
  }
  onpage.push(internal > 0
    ? { label: "İç bağlantılar", status: "pass", detail: `${internal} iç link, ${external} dış link` }
    : { label: "İç bağlantılar", status: "warn", detail: "İç bağlantı bulunamadı" });
  // dil & hreflang
  onpage.push(has(/<html[^>]+lang=["'][^"']+["']/i)
    ? { label: "Dil etiketi (html lang)", status: "pass", detail: "Tanımlı" }
    : { label: "Dil etiketi (html lang)", status: "warn", detail: "Tanımsız" });
  const hreflang = count(/hreflang=["'][^"']+["']/gi);
  onpage.push(hreflang > 0
    ? { label: "hreflang (çok pazar/uluslararası)", status: "pass", detail: `${hreflang} alternatif dil/pazar bağlantısı` }
    : { label: "hreflang (çok pazar/uluslararası)", status: "warn", detail: "hreflang yok — pazarlar arası SEO zayıf" });
  onpage.push(has(/<meta[^>]+name=["']viewport["']/i)
    ? { label: "Mobil viewport", status: "pass", detail: "Tanımlı" }
    : { label: "Mobil viewport", status: "fail", detail: "Yok — mobil uyumsuz" });

  // ── GEO / yapısal veri (AI motorları) ──
  const ldBlocks = Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1]);
  const ldTypes = new Set<string>();
  for (const b of ldBlocks) {
    try {
      const j = JSON.parse(b.trim());
      const arr = Array.isArray(j) ? j : j["@graph"] && Array.isArray(j["@graph"]) ? j["@graph"] : [j];
      for (const node of arr) { const ty = node?.["@type"]; if (typeof ty === "string") ldTypes.add(ty); else if (Array.isArray(ty)) ty.forEach((x: string) => ldTypes.add(x)); }
    } catch {}
  }
  const typeList = Array.from(ldTypes);
  geo.push(ldBlocks.length > 0
    ? { label: "Yapısal veri (JSON-LD)", status: "pass", detail: `${ldBlocks.length} blok${typeList.length ? " — " + typeList.slice(0, 6).join(", ") : ""}` }
    : { label: "Yapısal veri (JSON-LD)", status: "fail", detail: "Schema.org verisi yok — AI motorları içeriği zor anlar" });
  const hasOrg = typeList.some((t) => /organization/i.test(t));
  geo.push(hasOrg
    ? { label: "Kurum şeması (Organization)", status: "pass", detail: "Marka/kurum kimliği tanımlı" }
    : { label: "Kurum şeması (Organization)", status: "warn", detail: "Organization şeması yok — varlık (entity) sinyali zayıf" });
  const hasProduct = typeList.some((t) => /product|offer/i.test(t));
  geo.push(hasProduct
    ? { label: "Ürün şeması (Product/Offer)", status: "pass", detail: "Ürün verisi zengin sonuç için hazır" }
    : { label: "Ürün şeması (Product/Offer)", status: "warn", detail: "Ürün şeması yok (ürün sayfaları için önerilir)" });
  const hasBreadcrumb = typeList.some((t) => /breadcrumb/i.test(t));
  geo.push(hasBreadcrumb
    ? { label: "Breadcrumb şeması", status: "pass", detail: "Gezinme yolu tanımlı" }
    : { label: "Breadcrumb şeması", status: "warn", detail: "BreadcrumbList yok" });
  const hasFaq = typeList.some((t) => /faq|qapage|question/i.test(t));
  geo.push(hasFaq
    ? { label: "SSS / Soru-Cevap şeması", status: "pass", detail: "AI motorlarının doğrudan alıntılayacağı Q&A var" }
    : { label: "SSS / Soru-Cevap şeması", status: "warn", detail: "FAQ/QAPage yok — AI cevaplarında öne çıkmayı zorlaştırır" });
  const ogTitle = has(/property=["']og:title["']/i), ogImage = has(/property=["']og:image["']/i), ogDesc = has(/property=["']og:description["']/i);
  const ogCount = [ogTitle, ogImage, ogDesc].filter(Boolean).length;
  geo.push(ogCount === 3
    ? { label: "Open Graph (paylaşım/AI önizleme)", status: "pass", detail: "og:title, og:description, og:image tam" }
    : ogCount > 0
      ? { label: "Open Graph (paylaşım/AI önizleme)", status: "warn", detail: "Eksik: " + [!ogTitle && "og:title", !ogDesc && "og:description", !ogImage && "og:image"].filter(Boolean).join(", ") }
      : { label: "Open Graph (paylaşım/AI önizleme)", status: "fail", detail: "Open Graph etiketi yok" });
  geo.push(has(/name=["']twitter:card["']/i)
    ? { label: "Twitter/X kartı", status: "pass", detail: "Var" }
    : { label: "Twitter/X kartı", status: "warn", detail: "Yok" });
  geo.push(words >= 600
    ? { label: "İçerik derinliği (AI için)", status: "pass", detail: `~${words} kelime — kapsamlı, alıntılanabilir` }
    : { label: "İçerik derinliği (AI için)", status: "warn", detail: `~${words} kelime — AI motorları için sığ olabilir` });

  // ── Görseller ──
  const modernImg = count(/\.(webp|avif)\b/gi);
  const lazyImg = count(/loading=["']lazy["']/gi);
  const dimImg = count(/<img[^>]*\bwidth=["']?\d/gi);
  images.push(imgTotal === 0 || imgNoAlt === 0
    ? { label: "Alt metni kapsamı", status: "pass", detail: imgTotal === 0 ? "Görsel yok" : `${imgTotal} görselin tümünde alt var` }
    : { label: "Alt metni kapsamı", status: imgNoAlt / imgTotal > 0.3 ? "fail" : "warn", detail: `${imgNoAlt}/${imgTotal} görselde alt eksik` });
  images.push(imgTotal === 0
    ? { label: "Modern format (WebP/AVIF)", status: "pass", detail: "Görsel yok" }
    : modernImg > 0
      ? { label: "Modern format (WebP/AVIF)", status: "pass", detail: `${modernImg} modern format görsel` }
      : { label: "Modern format (WebP/AVIF)", status: "warn", detail: "WebP/AVIF kullanılmıyor — dosya boyutu büyük" });
  images.push(imgTotal <= 3
    ? { label: "Lazy loading", status: "pass", detail: imgTotal === 0 ? "Görsel yok" : "Az görsel — gerek yok" }
    : lazyImg > 0
      ? { label: "Lazy loading", status: "pass", detail: `${lazyImg} görsel lazy yükleniyor` }
      : { label: "Lazy loading", status: "warn", detail: "loading=lazy yok — ilk yük ağırlaşır" });
  images.push(imgTotal === 0
    ? { label: "Boyut tanımı (CLS)", status: "pass", detail: "Görsel yok" }
    : dimImg / imgTotal > 0.6
      ? { label: "Boyut tanımı (CLS)", status: "pass", detail: "Görsellerin çoğunda width/height var" }
      : { label: "Boyut tanımı (CLS)", status: "warn", detail: "Çoğu görselde boyut yok — kayma (CLS) riski" });

  // ── Mobil ──
  const deviceWidth = has(/name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i);
  mobile.push(deviceWidth
    ? { label: "Responsive viewport", status: "pass", detail: "width=device-width tanımlı" }
    : { label: "Responsive viewport", status: "fail", detail: "Responsive viewport yok — mobilde bozulur" });
  mobile.push(has(/name=["']theme-color["']/i)
    ? { label: "Tema rengi (theme-color)", status: "pass", detail: "Tanımlı" }
    : { label: "Tema rengi (theme-color)", status: "warn", detail: "Yok" });
  mobile.push(has(/rel=["'](apple-touch-icon|icon)["']/i)
    ? { label: "Dokunmatik ikon / favicon", status: "pass", detail: "Tanımlı" }
    : { label: "Dokunmatik ikon / favicon", status: "warn", detail: "Yok" });

  return {
    groups: [
      { id: "tech", title: "Teknik SEO & Taranabilirlik", checks: tech },
      { id: "onpage", title: "Sayfa İçi SEO", checks: onpage },
      { id: "images", title: "Görseller", checks: images },
      { id: "mobile", title: "Mobil Uyumluluk", checks: mobile },
      { id: "geo", title: "GEO / Yapısal Veri (AI motorları)", checks: geo },
    ],
    pageText: text,
    title: title ?? "",
    desc: desc ?? "",
    origin,
  };
}

// ── Site geneli tarayıcı: sitemap'ten 1500 URL'e kadar ─────────────────────
const CRAWL_LIMIT = 1500;
async function siteCrawl(origin: string, scopeUrl: string): Promise<CheckGroup | null> {
  if (!origin) return null;
  try {
    const extractLocs = (xml: string) =>
      Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((m) => m[1].trim()).filter((u) => /^https?:\/\//i.test(u));

    // kapsam: girilen URL'nin ilk yol segmenti (örn. /tr) — sadece o dil/ülke
    let prefix = "";
    let country = "";
    try {
      const seg = new URL(scopeUrl).pathname.split("/").filter(Boolean)[0];
      if (seg) { prefix = "/" + seg; country = seg; }
    } catch {}
    const inScope = (u: string) => {
      if (!prefix) return true;
      try { const p = new URL(u).pathname; return p === prefix || p.startsWith(prefix + "/"); } catch { return false; }
    };

    // robots.txt'teki TÜM sitemap'ler → kapsamla eşleşeni seç (Bosch her ülke için ayrı sitemap listeler)
    const robots = await safeFetchText(origin + "/robots.txt", 6000);
    const sitemaps = Array.from(robots.text.matchAll(/sitemap:\s*(\S+)/gi)).map((m) => m[1].trim());
    let sitemapUrl = origin + "/sitemap.xml";
    if (prefix) {
      const byPath = sitemaps.find((s) => { try { return new URL(s).pathname.startsWith(prefix + "/"); } catch { return false; } });
      const byToken = sitemaps.find((s) => new RegExp(`[/_.\\-]${country}([/_.\\-]|$)`, "i").test(s));
      sitemapUrl = byPath || byToken || sitemaps[0] || sitemapUrl;
    } else if (sitemaps[0]) {
      sitemapUrl = sitemaps[0];
    }
    const root = await safeFetchText(sitemapUrl, 9000);
    if (!root.ok) return null;

    // sitemap index ise alt-sitemap'leri gez — kapsamdaki (örn. TR) alt-sitemap'leri öne al
    let urls: string[] = [];
    if (/<sitemapindex/i.test(root.text)) {
      let children = extractLocs(root.text);
      if (country) {
        const rx = new RegExp(`[/_.\\-]${country}([/_.\\-]|$)`, "i");
        children = [...children.filter((c) => rx.test(c)), ...children.filter((c) => !rx.test(c))];
      }
      children = children.slice(0, 40);
      for (const child of children) {
        if (urls.filter(inScope).length >= CRAWL_LIMIT) break;
        const sub = await safeFetchText(child, 8000);
        if (sub.ok) urls.push(...extractLocs(sub.text));
      }
    } else {
      urls = extractLocs(root.text);
    }

    // KATI kapsam filtresi: yalnızca girilen dil/ülke (örn. /tr) sayfaları
    urls = Array.from(new Set(urls.filter(inScope))).slice(0, CRAWL_LIMIT);
    const totalFound = urls.length;
    if (totalFound < 2) return null;

    // tarama: eşzamanlı havuz + süre bütçesi (patlamayı önler)
    const pages: { url: string; title: string | null; desc: string | null; h1: boolean }[] = [];
    const deadline = Date.now() + 180000;
    const pool = 20;
    let idx = 0;
    async function worker() {
      while (idx < urls.length && Date.now() < deadline) {
        const u = urls[idx++];
        const r = await safeFetchText(u, 5000);
        if (r.ok) {
          const title = (r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || null;
          const desc = (r.text.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "").trim() || null;
          const h1 = /<h1[\s>]/i.test(r.text);
          pages.push({ url: u, title, desc, h1 });
        }
      }
    }
    await Promise.all(Array.from({ length: pool }, worker));
    if (pages.length < 2) return null;

    const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
    const dupUrls = (key: "title" | "desc") => {
      const map = new Map<string, string[]>();
      pages.forEach((p) => {
        const v = norm(p[key]);
        if (!v) return;
        if (!map.has(v)) map.set(v, []);
        map.get(v)!.push(p.url);
      });
      const out: string[] = [];
      map.forEach((list) => { if (list.length > 1) out.push(...list); });
      return out;
    };
    const dupTitleUrls = dupUrls("title");
    const dupDescUrls = dupUrls("desc");
    const missTitleUrls = pages.filter((p) => !p.title).map((p) => p.url);
    const missDescUrls = pages.filter((p) => !p.desc).map((p) => p.url);
    const missH1Urls = pages.filter((p) => !p.h1).map((p) => p.url);

    const scopeNote = prefix ? ` · kapsam: ${prefix}` : "";
    const partial = pages.length < totalFound ? ` (süre limitinden ${totalFound} URL'nin ${pages.length}'i)` : "";

    const checks: Check[] = [
      { label: "Taranan sayfalar", status: "pass", detail: `${pages.length} sayfa tarandı${partial}${scopeNote} · limit ${CRAWL_LIMIT}`, urls: pages.map((p) => p.url) },
      dupTitleUrls.length === 0
        ? { label: "Yinelenen başlıklar (title)", status: "pass", detail: "Tekrarlayan başlık yok" }
        : { label: "Yinelenen başlıklar (title)", status: dupTitleUrls.length > 5 ? "fail" : "warn", detail: `${dupTitleUrls.length} sayfada tekrar eden başlık`, urls: dupTitleUrls },
      dupDescUrls.length === 0
        ? { label: "Yinelenen meta açıklamalar", status: "pass", detail: "Tekrarlayan meta yok" }
        : { label: "Yinelenen meta açıklamalar", status: dupDescUrls.length > 5 ? "fail" : "warn", detail: `${dupDescUrls.length} sayfada tekrar eden meta`, urls: dupDescUrls },
      missTitleUrls.length === 0
        ? { label: "Eksik başlık", status: "pass", detail: "Tüm sayfalarda başlık var" }
        : { label: "Eksik başlık", status: "fail", detail: `${missTitleUrls.length} sayfada başlık yok`, urls: missTitleUrls },
      missDescUrls.length === 0
        ? { label: "Eksik meta açıklama", status: "pass", detail: "Tüm sayfalarda meta var" }
        : { label: "Eksik meta açıklama", status: missDescUrls.length > pages.length / 2 ? "fail" : "warn", detail: `${missDescUrls.length} sayfada meta yok`, urls: missDescUrls },
      missH1Urls.length === 0
        ? { label: "Eksik H1", status: "pass", detail: "Tüm sayfalarda H1 var" }
        : { label: "Eksik H1", status: missH1Urls.length > pages.length / 2 ? "fail" : "warn", detail: `${missH1Urls.length} sayfada H1 yok`, urls: missH1Urls },
    ];
    return { id: "site", title: `Site Geneli Taraması (en fazla ${CRAWL_LIMIT} sayfa)`, checks };
  } catch {
    return null;
  }
}

export async function auditSite(rawUrl: string): Promise<AuditResponse> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };

  let url = (rawUrl || "").trim();
  if (!url) return { ok: false, error: "URL boş" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const [lh, crawlRes] = await Promise.all([fetchLighthouse(url), crawl(url)]);
  if (!lh.ok) return { ok: false, error: lh.error };

  // AI analizi + sınırlı site crawl (paralel)
  const [ai, siteGroup] = await Promise.all([
    analyzeContentAI({ url: lh.finalUrl, title: crawlRes.title, metaDescription: crawlRes.desc, pageText: crawlRes.pageText }).catch(() => null),
    siteCrawl(crawlRes.origin, lh.finalUrl).catch(() => null),
  ]);

  // Performans grubunu (metrik durumlarından) ekle
  const perfChecks: Check[] = [
    { label: "Performans skoru (Lighthouse)", status: scoreToStatus(lh.perfScore), detail: lh.perfScore == null ? "—" : `${Math.round(lh.perfScore * 100)} / 100` },
    ...lh.metrics.map((m) => ({ label: m.key, status: m.status, detail: m.value })),
  ];
  const groups: CheckGroup[] = [...crawlRes.groups, { id: "perf", title: "Performans (hız)", checks: perfChecks }];
  if (siteGroup) groups.push(siteGroup);

  // Her kontrole "öneri / nasıl düzeltilir" metnini bağla
  for (const g of groups) g.checks = g.checks.map((c) => ({ ...c, fix: c.fix ?? FIX[c.label] }));

  // Sağlık skoru: tüm kontrollerden ağırlıklı
  const all = groups.flatMap((g) => g.checks);
  const errors = all.filter((c) => c.status === "fail").length;
  const warnings = all.filter((c) => c.status === "warn").length;
  const passes = all.filter((c) => c.status === "pass").length;
  const total = all.length || 1;
  const health = Math.round((100 * (passes + warnings * 0.5)) / total);

  return {
    ok: true,
    data: {
      finalUrl: lh.finalUrl,
      health,
      counts: { errors, warnings, passes },
      perfScore: lh.perfScore,
      metrics: lh.metrics,
      opportunities: lh.opportunities,
      groups,
      ai,
    },
  };
}
