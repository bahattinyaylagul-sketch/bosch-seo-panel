"use server";
import { gunzipSync } from "node:zlib";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyzeContentAI, analyzeSeoActionPlan, translateBatch, type AiAnalysis, type SeoActionPlan } from "@/lib/audit-ai";
import { getLocale } from "@/lib/i18n-server";

// Rapor deterministik metinlerini seçili dile çevir (görüntüleme anında, önbelleklenir)
export async function translateReportStrings(texts: string[], locale: string): Promise<Record<string, string>> {
  const profile = await getProfile();
  if (!profile) return {};
  const uniq = Array.from(new Set(texts.filter((t) => t && t.trim())));
  if (!uniq.length) return {};
  const out = await translateBatch(uniq, locale);
  const map: Record<string, string> = {};
  uniq.forEach((t, i) => { if (out[i] && out[i] !== t) map[t] = out[i]; });
  return map;
}
// ─────────────────────────────────────────────────────────────────────────────
// v2 MOTOR — Site geneli bulgular kategorilere dağıtıldı (Screaming Frog tarzı)
// - Her kontrol etkilenen URL listesini taşır (URL_CAP ile sınırlı)
// - Skor çifte sayımları temizlendi (alt metni ×2, perf skoru vs metrikler)
// - Bilgi satırları (info) skora girmez
// - "Ham HTML" vurgusu: AI crawler'lar JS render etmez — bulgular buna göre etiketli
// - Kontroller grup içinde hata → uyarı → başarılı sırasında gelir
// ─────────────────────────────────────────────────────────────────────────────
export type CheckStatus = "pass" | "warn" | "fail";
export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
  urls?: string[]; // etkilenen sayfalar
  info?: boolean;  // bilgi satırı — skora girmez
  scope?: "site";  // site geneli kontrol (yoksa girilen sayfa)
}
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
  aiError?: string;
  // ── v3 ek alanları (opsiyonel) ──
  serp?: { title: string | null; desc: string | null; url: string };
  social?: { ogTitle: string | null; ogDesc: string | null; ogImage: string | null; twitterCard: boolean };
  headings?: { tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; text: string }[];
  contentStats?: { words: number; textCodeRatio: number; topWords: { word: string; count: number }[] };
  imagesList?: { src: string; alt: string | null; kb: number | null; status: number | null }[];
  linksList?: { href: string; anchor: string; type: "internal" | "external"; status: number | null }[];
  perfDesktop?: { score: number | null; metrics: { key: string; value: string; status: CheckStatus }[] } | null;
  crux?: { lcp: string | null; inp: string | null; cls: string | null };
  aiAccess?: { bot: string; allowed: boolean }[];
  llmsTxt?: boolean;
  redirectChain?: { url: string; status: number }[];
  seoPlan?: SeoActionPlan | null; // AI ile deterministik bulgulardan öncelikli aksiyon planı
  crawlSummary?: { pages: number; ok: number; broken: number; redirected: number };
  infoCount?: number; // "Bilgi/Notice" satır sayısı
  scores?: { key: string; label: string; value: number; group: string }[]; // 8 ana kategori skoru (0-100)
}

// Mevcut tüm kontrolleri 8 ana kategoriye eşleyip 0-100 skor üretir (deterministik + AI harmanı)
function computeCategoryScores(groups: CheckGroup[], ai: AiAnalysis | null): { key: string; label: string; value: number; group: string }[] {
  const b: Record<string, Check[]> = { tech: [], crawl: [], index: [], onpage: [], linking: [], content: [], semantic: [], geo: [] };
  for (const g of groups) for (const c of g.checks) {
    if (c.info) continue;
    const L = c.label;
    if (/HTTPS|TTFB|Sıkıştırma|HTML boyutu|HSTS|X-Content|viewport|Tema rengi|Dokunmatik|Responsive/i.test(L)) b.tech.push(c);
    else if (/robots\.txt|Sitemap|Kırık link|Yönlendirme zinciri|Erişilemeyen|Yönlendirilen/i.test(L)) b.crawl.push(c);
    else if (/İndekslenebilir|noindex|Canonical|HTTP durumu/i.test(L)) b.index.push(c);
    else if (/İç bağlantı|hreflang/i.test(L)) b.linking.push(c);
    else if (/İçerik uzunluğu|Zayıf içerik|İçerik derinliği/i.test(L)) b.content.push(c);
    else if (/şema|schema|JSON-LD|Organization|Product|Breadcrumb|SSS|FAQ|Yapısal/i.test(L)) b.semantic.push(c);
    else if (/Open Graph|Twitter|Client-side|AI bot|llms/i.test(L)) b.geo.push(c);
    else b.onpage.push(c);
  }
  const ratio = (arr: Check[]): number | null => {
    if (!arr.length) return null;
    const pass = arr.filter((c) => c.status === "pass").length;
    const warn = arr.filter((c) => c.status === "warn").length;
    return Math.round((100 * (pass + warn * 0.5)) / arr.length);
  };
  const avg = (dims: { score: number }[] | undefined): number | null => (dims && dims.length ? Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length) : null);
  const blend = (a: number | null, bb: number | null): number => {
    const xs = [a, bb].filter((v): v is number => v != null);
    return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : 0;
  };
  const contentAI = ai ? avg(ai.contentQuality) : null;
  const semanticAI = ai ? avg([...(ai.contentQuality || []).filter((d) => /semantic|topical/i.test(d.key)), ...(ai.geo || []).filter((d) => /entity/i.test(d.key))]) : null;
  const geoAI = ai ? avg([...(ai.aiVisibility || []), ...(ai.geo || [])]) : null;
  return [
    { key: "tech", label: "Teknik Sağlık", value: ratio(b.tech) ?? 100, group: "tech" },
    { key: "crawl", label: "Tarama Sağlığı", value: ratio(b.crawl) ?? 100, group: "tech" },
    { key: "index", label: "İndekslenebilirlik", value: ratio(b.index) ?? 100, group: "tech" },
    { key: "onpage", label: "Sayfa İçi SEO", value: ratio(b.onpage) ?? 100, group: "onpage" },
    { key: "linking", label: "İç Bağlantı", value: ratio(b.linking) ?? 100, group: "onpage" },
    { key: "content", label: "İçerik Kalitesi", value: blend(ratio(b.content), contentAI), group: "onpage" },
    { key: "semantic", label: "Semantik SEO", value: blend(ratio(b.semantic), semanticAI), group: "geo" },
    { key: "geo", label: "AI Görünürlük / GEO", value: blend(ratio(b.geo), geoAI), group: "geo" },
  ];
}
export type AuditResponse = { ok: true; data: AuditData } | { ok: false; error: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (compatible; BoschSEOPanel/2.0; +https://bosch-seo)";
const URL_CAP = 100;        // check başına dönen maksimum URL (payload patlamasın)
const CRAWL_LIMIT = 1500;   // sitemap'ten alınacak maksimum URL
const CRAWL_BUDGET_MS = 120_000; // site taraması toplam süre bütçesi
const CRAWL_POOL = 20;      // eşzamanlı fetch havuzu
function scoreToStatus(s: number | null | undefined): CheckStatus {
  if (s == null) return "warn";
  return s >= 0.9 ? "pass" : s >= 0.5 ? "warn" : "fail";
}
// Kontrol başlığına göre "öneri / nasıl düzeltilir" metni
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
  "H1 başlığı": "Ham HTML'e tek bir H1 ekleyin ve ana anahtar kelimeyi içersin. JS ile basılan H1'i AI crawler'lar görmez.",
  "Başlık hiyerarşisi (H2+)": "İçeriği H2/H3 alt başlıklarla bölerek mantıksal bir hiyerarşi kurun.",
  "İçerik uzunluğu": "İçeriği en az 300+ kelimeye çıkararak konuyu kapsamlı işleyin.",
  "İç bağlantılar": "İlgili sayfalara bağlam içeren (contextual) iç bağlantılar ekleyin.",
  "Dil etiketi (html lang)": '<html lang="tr"> gibi bir dil etiketi tanımlayın.',
  "hreflang (girilen sayfa)": "Diller/pazarlar arası hreflang etiketleri ekleyin — çok pazarlı yapı için kritik.",
  "Mobil viewport": '<meta name=viewport content="width=device-width, initial-scale=1"> ekleyin.',
  "Alt metni kapsamı": "Alt metni olmayan görsellere kısa, açıklayıcı alt metni ekleyin.",
  "Modern format (WebP/AVIF)": "Görselleri WebP/AVIF formatında sunarak dosya boyutunu düşürün.",
  "Lazy loading": 'Ekran dışı görsellere loading="lazy" ekleyin; ilk yük hızlanır.',
  "Boyut tanımı (CLS)": "Görsellere width/height verin veya aspect-ratio kullanın; düzen kaymasını (CLS) önler.",
  "Responsive viewport": "width=device-width içeren viewport meta etiketi ekleyin.",
  "Tema rengi (theme-color)": "<meta name=theme-color> etiketi ekleyin.",
  "Dokunmatik ikon / favicon": "apple-touch-icon ve favicon tanımlayın.",
  "Yapısal veri (JSON-LD)": "Ham HTML'e Schema.org JSON-LD ekleyin (Organization, Product, BreadcrumbList, FAQ). AI motorları için kritik.",
  "Kurum şeması (Organization)": "Organization/LocalBusiness şeması ekleyerek marka varlığını (entity) netleştirin.",
  "Ürün şeması (Product/Offer)": "Ürün sayfalarına Product + Offer şeması ekleyin (fiyat, stok, puan).",
  "Breadcrumb şeması": "BreadcrumbList şeması ekleyerek gezinme yolunu tanımlayın.",
  "SSS / Soru-Cevap şeması": "Sık sorulan sorular için FAQPage şeması ekleyin — AI cevaplarında öne çıkarır.",
  "Open Graph (paylaşım/AI önizleme)": "og:title, og:description ve og:image etiketlerini tamamlayın.",
  "Twitter/X kartı": "twitter:card (ve ilgili) meta etiketlerini ekleyin.",
  "İçerik derinliği (AI için)": "İçeriği 600+ kelimeye çıkararak AI motorlarının alıntılayabileceği derinlik sağlayın.",
  "Client-side rendering (CSR) riski": "Kritik içeriği (H1, metin, JSON-LD) sunucu tarafında (SSR/SSG) render edin. GPTBot, ClaudeBot, PerplexityBot JS çalıştırmaz.",
  "LCP": "En büyük içerik ögesini hızlandırın: görsel optimizasyonu, sunucu yanıtı, render-blocking kaldırma.",
  "CLS": "Görsel/reklam alanlarına sabit boyut verin; geç yüklenen içeriğin sayfayı kaydırmasını önleyin.",
  "FCP": "Kritik CSS'i satır içi yapın, render-blocking kaynakları azaltın.",
  "TBT": "Uzun JavaScript görevlerini bölün, kullanılmayan JS'i kaldırın.",
  "Speed Index": "Sayfanın görünür kısmının daha erken çizilmesini sağlayın.",
  "Kırık linkler (girilen sayfa)": "4xx/5xx dönen hedef bağlantıları düzeltin veya kaldırın; kullanıcı ve crawler deneyimini bozar.",
  "Yönlendirme zinciri": "Girilen URL'yi tek adımda (301'siz) nihai adrese götürün; zincir crawl bütçesi ve hız kaybettirir.",
  "AI bot erişimi": "robots.txt'te AI botlarını (GPTBot, ClaudeBot, PerplexityBot) bilinçli engellemediyseniz Disallow kurallarını gözden geçirin.",
  "llms.txt": "Kök dizine llms.txt ekleyerek AI motorlarına içerik rehberi sunun (yeni, opsiyonel standart).",
  "URL hijyeni (site geneli)": "URL'leri kısa, küçük harf, tire ayraçlı ve sığ (az segmentli) tutun; okunabilir ve taranabilir olsun.",
  "INP (gerçek kullanıcı)": "Etkileşim gecikmesini azaltın: uzun JS görevlerini bölün, ana thread'i boşaltın (CrUX gerçek kullanıcı verisi).",
  "Soft 404": "200 dönen ama içeriği olmayan sayfaları gerçek 404 döndürün ya da içerik ekleyin; AI/arama motorlarını yanıltmasın.",
  "WWW tutarlılığı (site geneli)": "Tek bir ana host'ta karar kılın (www veya www'siz) ve diğerini 301 ile yönlendirin.",
  "Parametreli URL'ler (site geneli)": "Parametreli URL'lere canonical verin veya parametreleri Search Console'da tanımlayın; yinelenen içerik ve crawl bütçesi kaybını önler.",
  "İçindekiler (TOC)": "Uzun içeriklere sayfa-içi bağlantılı bir içindekiler (TOC) ekleyin; hem UX hem AI pasaj çıkarımı için faydalı.",
  "Tablo & liste kullanımı": "Bilgiyi tablo ve listelerle yapılandırın; AI motorları bunları daha kolay alıntılar.",
  "HTTP → HTTPS yönlendirmesi": "http:// adresini 301 ile https:// sürümüne yönlendirin.",
  "Yönlendirme döngüsü": "Yönlendirme döngüsünü kırın; sayfa hiç açılmaz ve crawler takılır.",
};
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
  crux: { lcp: string | null; inp: string | null; cls: string | null };
  inpMs: number | null;
};
async function fetchLighthouse(url: string, strategy: "mobile" | "desktop" = "mobile"): Promise<LhOk | { ok: false; error: string }> {
  const params = new URLSearchParams({ url, strategy });
  params.append("category", "performance");
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
  const MAX = 2; // bütçe: en kötü ~80 sn (eskiden 3×50 = 150 sn — maxDuration'ı zorluyordu)
  let lastErr = "Analiz tamamlanamadı.";
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
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
      // CrUX (gerçek kullanıcı) — sadece mobil yanıtta anlamlı, alan yoksa null
      const le = (data?.loadingExperience?.metrics ?? {}) as Record<string, { percentile?: number }>;
      const lcpMs = le?.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
      const inpMs = le?.INTERACTION_TO_NEXT_PAINT?.percentile;
      const clsRaw = le?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
      const crux = {
        lcp: typeof lcpMs === "number" ? (lcpMs / 1000).toFixed(1) + " s" : null,
        inp: typeof inpMs === "number" ? inpMs + " ms" : null,
        cls: typeof clsRaw === "number" ? (clsRaw / 100).toFixed(2) : null,
      };
      return { ok: true, finalUrl: lr.finalUrl ?? url, perfScore: lr.categories?.performance?.score ?? null, metrics, opportunities, crux, inpMs: typeof inpMs === "number" ? inpMs : null };
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
// ── Yardımcı fetch'ler ─────────────────────────────────────────────────────
async function safeFetchText(u: string, ms: number): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(u, { cache: "no-store", redirect: "follow", signal: c.signal, headers: { "User-Agent": UA } });
    clearTimeout(t);
    const text = r.ok ? (await r.text()).slice(0, 300_000) : "";
    return { ok: r.ok, status: r.status, text, finalUrl: r.url || u };
  } catch {
    return { ok: false, status: 0, text: "", finalUrl: u };
  }
}
// Sitemap fetch — gzip'li (.xml.gz veya gövdesi gzip) sitemap'leri de açar
async function fetchXml(u: string, ms: number): Promise<{ ok: boolean; text: string }> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(u, { cache: "no-store", signal: c.signal, headers: { "User-Agent": UA } });
    clearTimeout(t);
    if (!r.ok) return { ok: false, text: "" };
    const buf = Buffer.from(await r.arrayBuffer());
    let text: string;
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      try { text = gunzipSync(buf).toString("utf-8"); } catch { text = buf.toString("utf-8"); }
    } else {
      text = buf.toString("utf-8");
    }
    return { ok: true, text: text.slice(0, 3_000_000) };
  } catch {
    return { ok: false, text: "" };
  }
}
// ── Girilen sayfanın derin analizi ─────────────────────────────────────────
interface EnteredPage {
  ok: boolean;
  finalUrl: string;
  origin: string;
  host: string;
  status: number;
  ttfb: number;
  headers: Headers | null;
  html: string;
  text: string;
  words: number;
  title: string | null;
  desc: string | null;
}
async function fetchEnteredPage(inputUrl: string): Promise<EnteredPage> {
  const empty: EnteredPage = { ok: false, finalUrl: inputUrl, origin: "", host: "", status: 0, ttfb: 0, headers: null, html: "", text: "", words: 0, title: null, desc: null };
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 15000);
    const t0 = Date.now();
    const res = await fetch(inputUrl, { cache: "no-store", redirect: "follow", signal: c.signal, headers: { "User-Agent": UA } });
    const ttfb = Date.now() - t0;
    clearTimeout(t);
    const html = (await res.text()).slice(0, 1_200_000);
    const finalUrl = res.url || inputUrl;
    const origin = (() => { try { return new URL(finalUrl).origin; } catch { return ""; } })();
    const host = (() => { try { return new URL(finalUrl).host; } catch { return ""; } })();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
    const words = text ? text.split(" ").length : 0;
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || null;
    const desc = ((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]) ?? "").trim() || null;
    return { ok: true, finalUrl, origin, host, status: res.status, ttfb, headers: res.headers, html, text, words, title, desc };
  } catch {
    return empty;
  }
}
// ── Site geneli tarama: sitemap'ten sayfa verisi topla ─────────────────────
interface PageInfo {
  url: string; status: number; redirected: boolean;
  title: string | null; desc: string | null; titleLen: number; descLen: number;
  h1: number; jsonld: boolean; canonical: boolean; noindex: boolean;
  imgTotal: number; imgNoAlt: number; words: number; hreflang: number; viewport: boolean;
  schemaOrg: boolean; schemaProduct: boolean; schemaBreadcrumb: boolean; schemaFaq: boolean;
}
interface SiteCrawlResult { pages: PageInfo[]; totalFound: number; prefix: string; partial: boolean }
async function siteCrawl(origin: string, scopeUrl: string): Promise<SiteCrawlResult | null> {
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
    // robots.txt'teki TÜM sitemap'ler → kapsamla eşleşeni seç
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
    const root = await fetchXml(sitemapUrl, 10000);
    if (!root.ok) return null;
    // sitemap index ise alt-sitemap'leri gez — kapsamdaki alt-sitemap'leri öne al
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
        const sub = await fetchXml(child, 9000);
        if (sub.ok) urls.push(...extractLocs(sub.text));
      }
    } else {
      urls = extractLocs(root.text);
    }
    urls = Array.from(new Set(urls.filter(inScope))).slice(0, CRAWL_LIMIT);
    const totalFound = urls.length;
    if (totalFound < 2) return null;
    const pages: PageInfo[] = [];
    const deadline = Date.now() + CRAWL_BUDGET_MS;
    let idx = 0;
    async function worker() {
      while (idx < urls.length && Date.now() < deadline) {
        const u = urls[idx++];
        const r = await safeFetchText(u, 5000);
        // Erişilemeyen (4xx/5xx/timeout) sayfaları da kaydet — bunlar da bulgu
        if (!r.ok) {
          pages.push({ url: u, status: r.status, redirected: false, title: null, desc: null, titleLen: 0, descLen: 0, h1: 0, jsonld: false, canonical: false, noindex: false, imgTotal: 0, imgNoAlt: 0, words: 0, hreflang: 0, viewport: false, schemaOrg: false, schemaProduct: false, schemaBreadcrumb: false, schemaFaq: false });
          continue;
        }
        const t = r.text;
        const strip = (s: string) => s.replace(/^\s*https?:\/\/[^/]+/i, "");
        const redirected = strip(r.finalUrl).replace(/\/+$/, "") !== strip(u).replace(/\/+$/, "");
        const title = (t.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || null;
        const desc = (t.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "").trim() || null;
        const h1 = (t.match(/<h1[\s>]/gi) || []).length;
        const jsonld = /<script[^>]+application\/ld\+json/i.test(t);
        const canonical = /<link[^>]+rel=["']canonical["']/i.test(t);
        const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(t);
        const imgTotal = (t.match(/<img[\s>]/gi) || []).length;
        const imgNoAlt = (t.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
        const hreflang = (t.match(/hreflang=["'][^"']+["']/gi) || []).length;
        const viewport = /<meta[^>]+name=["']viewport["']/i.test(t);
        const schemaOrg = /"@type"\s*:\s*"?[^"]*(Organization|LocalBusiness)/i.test(t);
        const schemaProduct = /"@type"\s*:\s*"?[^"]*(Product|Offer)/i.test(t);
        const schemaBreadcrumb = /"@type"\s*:\s*"?[^"]*Breadcrumb/i.test(t);
        const schemaFaq = /"@type"\s*:\s*"?[^"]*(FAQPage|QAPage|Question)/i.test(t);
        const body = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const words = body ? body.split(" ").length : 0;
        pages.push({ url: u, status: r.status, redirected, title, desc, titleLen: title?.length ?? 0, descLen: desc?.length ?? 0, h1, jsonld, canonical, noindex, imgTotal, imgNoAlt, words, hreflang, viewport, schemaOrg, schemaProduct, schemaBreadcrumb, schemaFaq });
      }
    }
    await Promise.all(Array.from({ length: CRAWL_POOL }, worker));
    if (pages.length < 2) return null;
    return { pages, totalFound, prefix, partial: pages.length < totalFound };
  } catch {
    return null;
  }
}
// ── Site geneli check üretici ──────────────────────────────────────────────
function siteCheck(label: string, bad: string[], failOver: number, okMsg: string, badMsg: (n: number) => string, fix: string): Check {
  if (bad.length === 0) return { label, status: "pass", detail: okMsg, fix, scope: "site" };
  const capped = bad.slice(0, URL_CAP);
  const capNote = bad.length > URL_CAP ? ` (ilk ${URL_CAP} listelendi)` : "";
  return { label, status: bad.length > failOver ? "fail" : "warn", detail: badMsg(bad.length) + capNote, urls: capped, fix, scope: "site" };
}
// ── v3 çıkarım yardımcıları ────────────────────────────────────────────────
async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } }
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, worker));
  return out;
}
function absUrl(src: string, base: string): string | null {
  try { return new URL(src, base).toString(); } catch { return null; }
}
function metaContent(html: string, attr: string, val: string): string | null {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${val}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${val}["']`, "i");
  return ((html.match(re1)?.[1] ?? html.match(re2)?.[1]) ?? "").trim() || null;
}
function extractSocial(html: string): { ogTitle: string | null; ogDesc: string | null; ogImage: string | null; twitterCard: boolean } {
  return {
    ogTitle: metaContent(html, "property", "og:title"),
    ogDesc: metaContent(html, "property", "og:description"),
    ogImage: metaContent(html, "property", "og:image"),
    twitterCard: /name=["']twitter:card["']/i.test(html),
  };
}
function extractHeadings(html: string): { tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; text: string }[] {
  const out: { tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; text: string }[] = [];
  const re = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 40) {
    const tag = m[1].toLowerCase() as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    if (text) out.push({ tag, text });
  }
  return out;
}
const STOPWORDS = new Set([
  "ve", "ile", "için", "bir", "bu", "da", "de", "en", "çok", "gibi", "olan", "olarak", "ya", "ki", "ama", "veya",
  "her", "daha", "sonra", "önce", "kadar", "hem", "ise", "göre", "tüm", "değil", "var", "yok", "the", "and", "for",
  "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "has", "with", "this", "that", "from",
  "your", "have", "more", "will", "home", "page", "www", "com", "http", "https", "bosch", "menü", "genel", "bakış",
  "daha", "fazla", "bilgi", "main", "navigation", "close", "kapat", "ara", "keşfet", "servis", "ürünler",
]);
function computeContentStats(html: string, text: string, words: number): { words: number; textCodeRatio: number; topWords: { word: string; count: number }[] } {
  const rawBytes = new TextEncoder().encode(html).length;
  const textBytes = new TextEncoder().encode(text).length;
  const textCodeRatio = rawBytes ? Math.round((100 * textBytes) / rawBytes) : 0;
  const freq = new Map<string, number>();
  const tokens = text.toLowerCase().match(/[a-zçğıöşü0-9]{3,}/gi) ?? [];
  for (const w of tokens) { if (STOPWORDS.has(w)) continue; freq.set(w, (freq.get(w) ?? 0) + 1); }
  const topWords = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));
  return { words, textCodeRatio, topWords };
}
async function headInfo(u: string, ms: number, allowGet = false): Promise<{ status: number | null; kb: number | null }> {
  const doFetch = async (method: string) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(u, { method, redirect: "follow", signal: c.signal, headers: { "User-Agent": UA } });
      clearTimeout(t);
      const cl = r.headers.get("content-length");
      const kb = cl ? Math.round(parseInt(cl, 10) / 1024) : null;
      return { status: r.status, kb };
    } catch { clearTimeout(t); return null; }
  };
  let res = await doFetch("HEAD");
  // HEAD güvenilmez: birçok sunucu HEAD'e 404/405/403 döner ama GET'e 200.
  // HEAD başarısız veya 4xx/5xx ise gerçek durumu GET ile doğrula.
  if (allowGet && (!res || res.status == null || res.status >= 400)) {
    const g = await doFetch("GET");
    if (g) res = g;
  }
  return res ?? { status: null, kb: null };
}
async function fetchImagesList(html: string, base: string): Promise<{ src: string; alt: string | null; kb: number | null; status: number | null }[]> {
  const tags = (html.match(/<img\b[^>]*>/gi) || []);
  const seen = new Set<string>();
  const items: { src: string; alt: string | null }[] = [];
  for (const tag of tags) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!src || /^data:/i.test(src)) continue;
    const abs = absUrl(src, base);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    const alt = /\balt=/i.test(tag) ? (tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "") : null;
    items.push({ src: abs, alt });
    if (items.length >= 15) break;
  }
  return runPool(items, 6, async (it) => {
    const h = await headInfo(it.src, 5000, true);
    return { src: it.src, alt: it.alt, kb: h.kb, status: h.status };
  });
}
async function fetchLinksList(html: string, base: string, host: string): Promise<{ list: { href: string; anchor: string; type: "internal" | "external"; status: number | null }[]; broken: string[] }> {
  const anchors = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const seen = new Set<string>();
  const items: { href: string; anchor: string; type: "internal" | "external" }[] = [];
  for (const m of anchors) {
    const raw = m[1];
    if (/^(#|javascript:|mailto:|tel:)/i.test(raw)) continue;
    const abs = absUrl(raw, base);
    if (!abs || !/^https?:/i.test(abs) || seen.has(abs)) continue;
    seen.add(abs);
    const anchor = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    let type: "internal" | "external" = "external";
    try { type = new URL(abs).host === host ? "internal" : "external"; } catch {}
    items.push({ href: abs, anchor, type });
    if (items.length >= 40) break;
  }
  const list = await runPool(items, 8, async (it) => {
    const h = await headInfo(it.href, 5000, true);
    return { ...it, status: h.status };
  });
  // Yanlış pozitifi önle: dış siteler (LinkedIn 999, Medium 403 vb.) botları engeller.
  // Sadece GERÇEK 5xx (500–599) her iki tarafta; 404/410 yalnızca İÇ linklerde kırık sayılır.
  // 401/403/405/429/999 = engelleme, kırık DEĞİL (999 > 599 olduğu için aralık dışı).
  const broken = list
    .filter((r) => r.status != null && ((r.status >= 500 && r.status < 600) || ((r.status === 404 || r.status === 410) && r.type === "internal")))
    .map((r) => r.href);
  return { list, broken };
}
function parseAiAccess(robots: string): { bot: string; allowed: boolean }[] {
  const bots = ["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "Bytespider"];
  const blocks: { agents: string[]; disallowAll: boolean }[] = [];
  let agents: string[] = [];
  let disallowAll = false;
  let sawDirective = false;
  const flush = () => { if (agents.length) blocks.push({ agents, disallowAll }); agents = []; disallowAll = false; sawDirective = false; };
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) { if (sawDirective) flush(); agents.push(ua[1].trim().toLowerCase()); continue; }
    const dis = line.match(/^disallow:\s*(.*)$/i);
    if (dis) { sawDirective = true; if (dis[1].trim() === "/") disallowAll = true; continue; }
    sawDirective = true;
  }
  flush();
  const blocked = (bot: string) => {
    const b = bot.toLowerCase();
    const specific = blocks.find((bl) => bl.agents.includes(b));
    if (specific) return specific.disallowAll;
    const star = blocks.find((bl) => bl.agents.includes("*"));
    return star ? star.disallowAll : false;
  };
  return bots.map((bot) => ({ bot, allowed: !blocked(bot) }));
}
async function fetchRedirectChain(startUrl: string): Promise<{ url: string; status: number }[]> {
  const chain: { url: string; status: number }[] = [];
  let u = startUrl;
  for (let i = 0; i < 5; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      const r = await fetch(u, { method: "GET", redirect: "manual", signal: c.signal, headers: { "User-Agent": UA } });
      clearTimeout(t);
      chain.push({ url: u, status: r.status });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) break;
        const next = absUrl(loc, u);
        if (!next) break;
        u = next;
      } else break;
    } catch { break; }
  }
  return chain;
}
async function fetchLlmsTxt(origin: string): Promise<boolean> {
  const r = await safeFetchText(origin + "/llms.txt", 5000);
  return r.ok;
}
async function checkHttpsRedirect(finalUrl: string): Promise<Check | null> {
  try {
    const u = new URL(finalUrl);
    if (u.protocol !== "https:") return { label: "HTTP → HTTPS yönlendirmesi", status: "fail", detail: "Site HTTPS değil", fix: FIX["HTTP → HTTPS yönlendirmesi"] };
    const httpUrl = "http://" + u.host + u.pathname;
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch(httpUrl, { redirect: "follow", signal: c.signal, headers: { "User-Agent": UA } }).catch(() => null);
    clearTimeout(t);
    if (!r) return null;
    return r.url.startsWith("https://")
      ? { label: "HTTP → HTTPS yönlendirmesi", status: "pass", detail: "http:// → https:// yönleniyor" }
      : { label: "HTTP → HTTPS yönlendirmesi", status: "fail", detail: "http:// HTTPS'e yönlenmiyor", fix: FIX["HTTP → HTTPS yönlendirmesi"] };
  } catch { return null; }
}
function urlHygieneBad(pages: PageInfo[]): string[] {
  const bad: string[] = [];
  for (const p of pages) {
    try {
      const path = new URL(p.url).pathname;
      const segs = path.split("/").filter(Boolean).length;
      if (p.url.length > 115 || /[A-Z]/.test(path) || path.includes("_") || segs >= 5) bad.push(p.url);
    } catch {}
  }
  return bad;
}

// ── Grupları kur: girilen sayfa + site geneli birleşik ─────────────────────
interface BuildExtra {
  brokenLinks?: Check | null;
  redirectChain?: Check | null;
  aiAccess?: Check | null;
  llmsTxt?: Check | null;
  httpsRedirect?: Check | null;
}
function buildGroups(page: EnteredPage, site: SiteCrawlResult | null, lh: LhOk, extra: BuildExtra = {}): CheckGroup[] {
  const html = page.html;
  const has = (re: RegExp) => re.test(html);
  const m1 = (re: RegExp) => { const m = html.match(re); return m ? m[1].trim() : null; };
  const count = (re: RegExp) => (html.match(re) || []).length;
  const h = (k: string) => page.headers?.get(k) ?? null;
  const P = site?.pages ?? [];
  const N = P.length;
  const sitewide = N >= 2;
  const of = (pred: (p: PageInfo) => boolean) => P.filter(pred).map((p) => p.url);
  const scopeTag = sitewide ? ` · ${N} sayfa` : " · girilen sayfa";
  const tech: Check[] = [];
  const onpage: Check[] = [];
  const geo: Check[] = [];
  const images: Check[] = [];
  const mobile: Check[] = [];
  const perf: Check[] = [];
  // ═══ TEKNİK SEO & TARANABİLİRLİK ═══
  if (sitewide) {
    const partial = site!.partial ? ` · süre limitinden ${site!.totalFound} URL'nin ${N}'i` : "";
    const scopeNote = site!.prefix ? ` · kapsam: ${site!.prefix}` : "";
    tech.push({ label: "Taranan sayfalar", status: "pass", info: true, detail: `${N} sayfa tarandı${partial}${scopeNote} · limit ${CRAWL_LIMIT}`, urls: P.slice(0, URL_CAP).map((p) => p.url) });
  }
  tech.push({ label: "HTTP durumu (girilen sayfa)", status: page.status >= 200 && page.status < 300 ? "pass" : "fail", detail: `${page.status}` });
  if (sitewide) {
    // Yalnız gerçek HTTP hataları (404/410/5xx). status 0 = zaman aşımı/ağ (yanlış pozitif),
    // 401/403/429/999 = bot engelleme — bunları "kırık" saymayız.
    tech.push(siteCheck("Erişilemeyen sayfalar (4xx/5xx)", of((p) => p.status === 404 || p.status === 410 || (p.status >= 500 && p.status < 600)), 0,
      "Tüm sayfalar erişilebilir", (n) => `${n} sayfa 404/410/5xx döndürüyor`,
      "Sitemap'te ölü URL bırakmayın; 404/500 dönen sayfaları düzeltin veya sitemap'ten çıkarın."));
    tech.push(siteCheck("Yönlendirilen sitemap URL'leri (3xx)", of((p) => p.redirected), Math.max(5, Math.floor(N / 10)),
      "Sitemap URL'leri doğrudan yanıt veriyor", (n) => `${n} sitemap URL'si başka adrese yönleniyor`,
      "Sitemap'te nihai (301'siz) URL'leri listeleyin; crawl bütçesi boşa gitmesin."));
  }
  tech.push(page.finalUrl.startsWith("https://")
    ? { label: "HTTPS (güvenli bağlantı)", status: "pass", detail: "Sertifikalı bağlantı" }
    : { label: "HTTPS (güvenli bağlantı)", status: "fail", detail: "Site HTTPS değil" });
  tech.push(page.ttfb < 800
    ? { label: "Sunucu yanıt süresi (TTFB)", status: "pass", detail: `${page.ttfb} ms` }
    : page.ttfb < 1800
      ? { label: "Sunucu yanıt süresi (TTFB)", status: "warn", detail: `${page.ttfb} ms (yavaş)` }
      : { label: "Sunucu yanıt süresi (TTFB)", status: "fail", detail: `${page.ttfb} ms (çok yavaş)` });
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
  const soft404 = page.status >= 200 && page.status < 300 && /(^|[^0-9])404([^0-9]|$)|sayfa bulunamad|aradığınız sayfa|page not found|not found/i.test((page.title || "") + " " + page.text.slice(0, 400));
  tech.push(soft404
    ? { label: "Soft 404", status: "fail", detail: "200 dönüyor ama içerik 'bulunamadı' sinyali veriyor" }
    : { label: "Soft 404", status: "pass", detail: "Soft 404 belirtisi yok" });
  // İndekslenebilirlik + canonical + noindex — site geneli varsa oradan, yoksa girilen sayfadan
  if (sitewide) {
    tech.push(siteCheck("noindex sayfalar", of((p) => p.noindex), 0,
      "Dizine kapalı sayfa yok", (n) => `${n} sayfa dizine kapalı (noindex)`, FIX["İndekslenebilirlik"]!));
    tech.push(siteCheck("Canonical yok", of((p) => p.status > 0 && p.status < 400 && !p.canonical), Math.floor(N / 2),
      "Tüm sayfalarda canonical var", (n) => `${n} sayfada canonical yok`, FIX["Canonical etiketi"]!));
    tech.push(siteCheck("Parametreli URL'ler (site geneli)", of((p) => p.url.includes("?")), Math.floor(N / 3),
      "Parametreli URL yok/az", (n) => `${n} sayfa URL parametresi içeriyor`, FIX["Parametreli URL'ler (site geneli)"]!));
    const wwwMixed = (() => { const set = new Set<string>(); P.forEach((p) => { try { set.add(new URL(p.url).host.startsWith("www.") ? "www" : "root"); } catch {} }); return set.size > 1; })();
    tech.push(wwwMixed
      ? { label: "WWW tutarlılığı (site geneli)", status: "warn", detail: "Sayfalar hem www hem www'siz host kullanıyor", scope: "site", fix: FIX["WWW tutarlılığı (site geneli)"] }
      : { label: "WWW tutarlılığı (site geneli)", status: "pass", detail: "Tek host varyantı (tutarlı)", scope: "site" });
  } else {
    const noindex = has(/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i);
    tech.push(noindex
      ? { label: "İndekslenebilirlik", status: "fail", detail: "noindex! Arama motoru dizine almaz" }
      : { label: "İndekslenebilirlik", status: "pass", detail: "Dizine alınabilir" });
    const canonical = m1(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    tech.push(canonical
      ? { label: "Canonical etiketi", status: "pass", detail: canonical.length > 70 ? canonical.slice(0, 67) + "…" : canonical }
      : { label: "Canonical etiketi", status: "warn", detail: "Yok — yinelenen içerik riski" });
  }
  // ═══ SAYFA İÇİ SEO ═══
  const h1 = count(/<h1[\s>]/gi);
  const h2 = count(/<h2[\s>]/gi);
  // Girilen sayfa detayları — YALNIZCA site geneli tarama YOKSA göster (aksi halde
  // "H1 başlığı" + "Eksik H1 (site geneli)" gibi kafa karıştırıcı ikili oluşuyor)
  if (!sitewide) {
    onpage.push(page.title
      ? { label: "Sayfa başlığı (title)", status: page.title.length >= 10 && page.title.length <= 60 ? "pass" : "warn", detail: `${page.title.length} karakter${page.title.length > 60 ? " (çok uzun, kesilebilir)" : page.title.length < 10 ? " (çok kısa)" : ""} — "${page.title.slice(0, 55)}"` }
      : { label: "Sayfa başlığı (title)", status: "fail", detail: "Başlık etiketi yok" });
    onpage.push(page.desc
      ? { label: "Meta açıklama", status: page.desc.length >= 50 && page.desc.length <= 160 ? "pass" : "warn", detail: `${page.desc.length} karakter (ideal 50–160)` }
      : { label: "Meta açıklama", status: "fail", detail: "Meta description yok" });
    onpage.push(h1 === 1
      ? { label: "H1 başlığı", status: "pass", detail: "Tek H1 (ideal)" }
      : h1 === 0
        ? { label: "H1 başlığı", status: "fail", detail: "Ham HTML'de H1 yok — AI crawler'lar (GPTBot, ClaudeBot) sayfayı başlıksız görür" }
        : { label: "H1 başlığı", status: "warn", detail: `${h1} adet H1 (tek olmalı)` });
    onpage.push(page.words >= 300
      ? { label: "İçerik uzunluğu", status: "pass", detail: `~${page.words} kelime` }
      : page.words >= 100
        ? { label: "İçerik uzunluğu", status: "warn", detail: `~${page.words} kelime (zayıf içerik)` }
        : { label: "İçerik uzunluğu", status: "fail", detail: `~${page.words} kelime (çok az)` });
  }
  onpage.push(h2 > 0
    ? { label: "Başlık hiyerarşisi (H2+)", status: "pass", detail: `${h2} adet H2 (girilen sayfa)` }
    : { label: "Başlık hiyerarşisi (H2+)", status: "warn", detail: "Alt başlık (H2) yok (girilen sayfa)" });
  const tocLinks = count(/<a[^>]+href=["']#[\w:.-]+["']/gi);
  onpage.push({ label: "İçindekiler (TOC)", status: tocLinks >= 3 ? "pass" : "warn", info: true, detail: tocLinks >= 3 ? `${tocLinks} sayfa-içi bağlantı (girilen sayfa)` : "Ham HTML'de sayfa-içi TOC yok — JS ile basılıyorsa AI crawler'lar görmez (girilen sayfa)" });
  const tables = count(/<table[\s>]/gi); const lists = count(/<(ul|ol)[\s>]/gi);
  onpage.push({ label: "Tablo & liste kullanımı", status: tables + lists > 0 ? "pass" : "warn", info: true, detail: `${tables} tablo, ${lists} liste (ham HTML · girilen sayfa)` });
  const hrefs = Array.from(html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)).map((m) => m[1]);
  let internal = 0, external = 0;
  for (const href of hrefs) {
    if (/^https?:\/\//i.test(href)) { try { new URL(href).host === page.host ? internal++ : external++; } catch {} }
    else if (href.startsWith("/")) internal++;
  }
  onpage.push(internal > 0
    ? { label: "İç bağlantılar", status: "pass", detail: `${internal} iç link, ${external} dış link` }
    : { label: "İç bağlantılar", status: "warn", detail: "İç bağlantı bulunamadı" });
  onpage.push(has(/<html[^>]+lang=["'][^"']+["']/i)
    ? { label: "Dil etiketi (html lang)", status: "pass", detail: "Tanımlı" }
    : { label: "Dil etiketi (html lang)", status: "warn", detail: "Tanımsız" });
  const hreflangN = count(/hreflang=["'][^"']+["']/gi);
  onpage.push(hreflangN > 0
    ? { label: "hreflang (girilen sayfa)", status: "pass", detail: `${hreflangN} alternatif dil/pazar bağlantısı` }
    : { label: "hreflang (girilen sayfa)", status: "warn", detail: "hreflang yok — pazarlar arası SEO zayıf" });
  // Site geneli on-page bulguları — URL listeleriyle
  if (sitewide) {
    const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
    const dupUrls = (key: "title" | "desc") => {
      const map = new Map<string, string[]>();
      P.forEach((p) => { const v = norm(p[key]); if (!v) return; if (!map.has(v)) map.set(v, []); map.get(v)!.push(p.url); });
      const out: string[] = [];
      map.forEach((list) => { if (list.length > 1) out.push(...list); });
      return out;
    };
    const live = (p: PageInfo) => p.status > 0 && p.status < 400;
    onpage.push(siteCheck("Eksik başlık (site geneli)", of((p) => live(p) && !p.title), 0,
      "Tüm sayfalarda başlık var", (n) => `${n} sayfada başlık yok`, FIX["Sayfa başlığı (title)"]!));
    onpage.push(siteCheck("Yinelenen başlıklar (site geneli)", dupUrls("title"), 5,
      "Tekrarlayan başlık yok", (n) => `${n} sayfada tekrar eden başlık`, "Aynı başlığı taşıyan sayfalara benzersiz title verin."));
    onpage.push(siteCheck("Uzun başlık >60 (site geneli)", of((p) => p.titleLen > 60), 10,
      "Başlık uzunlukları uygun", (n) => `${n} sayfada başlık çok uzun`, "Başlıkları 60 karakterin altına indirin; SERP'te kesilmesin."));
    onpage.push(siteCheck("Eksik meta açıklama (site geneli)", of((p) => live(p) && !p.desc), Math.floor(N / 2),
      "Tüm sayfalarda meta var", (n) => `${n} sayfada meta açıklama yok`, FIX["Meta açıklama"]!));
    onpage.push(siteCheck("Yinelenen meta açıklamalar (site geneli)", dupUrls("desc"), 5,
      "Tekrarlayan meta yok", (n) => `${n} sayfada tekrar eden meta`, "Aynı meta açıklamayı taşıyan sayfalara benzersiz açıklama yazın."));
    onpage.push(siteCheck("Meta uzunluğu 50–160 dışı (site geneli)", of((p) => !!p.desc && (p.descLen < 50 || p.descLen > 160)), 10,
      "Meta uzunlukları uygun", (n) => `${n} sayfada meta ideal aralık dışı`, FIX["Meta açıklama"]!));
    onpage.push(siteCheck("Eksik H1 (site geneli)", of((p) => live(p) && p.h1 === 0), Math.floor(N / 2),
      "Tüm sayfalarda H1 var", (n) => `${n} sayfada ham HTML'de H1 yok`, FIX["H1 başlığı"]!));
    onpage.push(siteCheck("Birden fazla H1 (site geneli)", of((p) => p.h1 > 1), 10,
      "Her sayfada tek H1", (n) => `${n} sayfada birden fazla H1`, "Sayfa başına tek H1 kullanın; diğerlerini H2/H3'e çevirin."));
    onpage.push(siteCheck("Zayıf içerik <200 kelime (site geneli)", of((p) => live(p) && p.words < 200), 10,
      "İçerik uzunlukları yeterli", (n) => `${n} sayfada içerik çok az`, FIX["İçerik uzunluğu"]!));
  }
  // ═══ GÖRSELLER ═══
  const imgTotal = count(/<img[\s>]/gi);
  const imgNoAlt = count(/<img(?![^>]*\balt=)[^>]*>/gi);
  if (sitewide) {
    images.push(siteCheck("Görsel alt metni eksik (site geneli)", of((p) => p.imgTotal > 0 && p.imgNoAlt / p.imgTotal > 0.3), 10,
      "Görsel alt metinleri yeterli", (n) => `${n} sayfada görsellerin çoğunda alt yok`, FIX["Alt metni kapsamı"]!));
  } else {
    images.push(imgTotal === 0 || imgNoAlt === 0
      ? { label: "Alt metni kapsamı", status: "pass", detail: imgTotal === 0 ? "Görsel yok" : `${imgTotal} görselin tümünde alt var` }
      : { label: "Alt metni kapsamı", status: imgNoAlt / imgTotal > 0.3 ? "fail" : "warn", detail: `${imgNoAlt}/${imgTotal} görselde alt eksik` });
  }
  const modernImg = count(/\.(webp|avif)\b/gi);
  const lazyImg = count(/loading=["']lazy["']/gi);
  const dimImg = count(/<img[^>]*\bwidth=["']?\d/gi);
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
  // ═══ MOBİL ═══
  const deviceWidth = has(/name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i);
  if (sitewide) {
    mobile.push(siteCheck("Viewport eksik (site geneli)", of((p) => p.status > 0 && p.status < 400 && !p.viewport), 0,
      "Tüm sayfalarda viewport var", (n) => `${n} sayfada viewport meta yok`, FIX["Mobil viewport"]!));
  }
  mobile.push(deviceWidth
    ? { label: "Responsive viewport", status: "pass", detail: "width=device-width tanımlı" }
    : { label: "Responsive viewport", status: "fail", detail: "Responsive viewport yok — mobilde bozulur" });
  mobile.push(has(/name=["']theme-color["']/i)
    ? { label: "Tema rengi (theme-color)", status: "pass", detail: "Tanımlı" }
    : { label: "Tema rengi (theme-color)", status: "warn", detail: "Yok" });
  mobile.push(has(/rel=["'](apple-touch-icon|icon)["']/i)
    ? { label: "Dokunmatik ikon / favicon", status: "pass", detail: "Tanımlı" }
    : { label: "Dokunmatik ikon / favicon", status: "warn", detail: "Yok" });
  // ═══ GEO / YAPISAL VERİ (AI motorları) ═══
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
  if (sitewide) {
    geo.push(siteCheck("Yapısal veri JSON-LD yok (site geneli)", of((p) => p.status > 0 && p.status < 400 && !p.jsonld), Math.floor(N / 2),
      "Tüm sayfalarda schema var", (n) => `${n} sayfanın ham HTML'inde JSON-LD yok — AI crawler'lar şemasız görüyor`, FIX["Yapısal veri (JSON-LD)"]!));
    geo.push(siteCheck("hreflang eksik (site geneli)", of((p) => p.status > 0 && p.status < 400 && p.hreflang === 0), Math.floor(N / 2),
      "Sayfalarda hreflang tanımlı", (n) => `${n} sayfada hreflang yok — çok pazarlı yapı için kritik`, FIX["hreflang (girilen sayfa)"]!));
  } else {
    geo.push(ldBlocks.length > 0
      ? { label: "Yapısal veri (JSON-LD)", status: "pass", detail: `${ldBlocks.length} blok${typeList.length ? " — " + typeList.slice(0, 6).join(", ") : ""}` }
      : { label: "Yapısal veri (JSON-LD)", status: "fail", detail: "Ham HTML'de Schema.org verisi yok — AI motorları içeriği zor anlar" });
  }
  if (sitewide) {
    const liveP = (p: PageInfo) => p.status > 0 && p.status < 400;
    geo.push(siteCheck("Kurum şeması (Organization)", of((p) => liveP(p) && !p.schemaOrg), Math.floor(N / 2),
      "Sayfalarda Organization şeması var", (n) => `${n} sayfada Organization şeması yok`, FIX["Kurum şeması (Organization)"]!));
    geo.push(siteCheck("Ürün şeması (Product/Offer)", of((p) => liveP(p) && !p.schemaProduct), Math.floor(N * 0.8),
      "Ürün şeması yaygın", (n) => `${n} sayfada Product/Offer şeması yok`, FIX["Ürün şeması (Product/Offer)"]!));
    geo.push(siteCheck("Breadcrumb şeması", of((p) => liveP(p) && !p.schemaBreadcrumb), Math.floor(N / 2),
      "Breadcrumb şeması tanımlı", (n) => `${n} sayfada BreadcrumbList yok`, FIX["Breadcrumb şeması"]!));
    geo.push(siteCheck("SSS / Soru-Cevap şeması", of((p) => liveP(p) && !p.schemaFaq), Math.floor(N * 0.8),
      "FAQ şeması mevcut", (n) => `${n} sayfada FAQ/QAPage yok`, FIX["SSS / Soru-Cevap şeması"]!));
  } else {
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
  }
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
  geo.push(page.words >= 600
    ? { label: "İçerik derinliği (AI için)", status: "pass", detail: `~${page.words} kelime — kapsamlı, alıntılanabilir` }
    : { label: "İçerik derinliği (AI için)", status: "warn", detail: `~${page.words} kelime — AI motorları için sığ olabilir` });
  // CSR tespiti: JS framework imzası + ham HTML'de içerik/H1/şema eksikliği
  const fw = has(/__NEXT_DATA__|id=["']__next["']|data-reactroot|ng-version=|id=["']app["'][^>]*><\/div>|window\.__NUXT__/i);
  const thinRaw = page.words < 150 || h1 === 0 || ldBlocks.length === 0;
  if (fw && thinRaw) {
    geo.push({ label: "Client-side rendering (CSR) riski", status: "warn", detail: "JS framework tespit edildi ve ham HTML'de kritik içerik eksik. Googlebot render eder ama AI crawler'lar (GPTBot, ClaudeBot, PerplexityBot) JS çalıştırmaz — sayfayı bu eksik haliyle görürler." });
  } else {
    geo.push({ label: "Client-side rendering (CSR) riski", status: "pass", detail: "Kritik içerik ham HTML'de mevcut görünüyor" });
  }
  // ═══ PERFORMANS ═══
  // Genel skor bilgi satırı olarak (metriklerle çifte sayım olmasın diye skora girmez)
  perf.push({ label: "Performans skoru (Lighthouse)", status: scoreToStatus(lh.perfScore), info: true, detail: lh.perfScore == null ? "—" : `${Math.round(lh.perfScore * 100)} / 100` });
  perf.push(...lh.metrics.map((m) => ({ label: m.key, status: m.status, detail: m.value })));
  // CrUX gerçek kullanıcı INP — veri geldiyse normal Check
  if (lh.inpMs != null) {
    const inpStatus: CheckStatus = lh.inpMs < 200 ? "pass" : lh.inpMs < 500 ? "warn" : "fail";
    perf.push({ label: "INP (gerçek kullanıcı)", status: inpStatus, detail: `${lh.inpMs} ms (CrUX)` });
  }
  // Dışarıdan gelen ek kontroller (async fetch gerektirenler)
  if (extra.redirectChain) tech.push(extra.redirectChain);
  if (extra.brokenLinks) tech.push(extra.brokenLinks);
  if (extra.httpsRedirect) tech.push(extra.httpsRedirect);
  if (extra.aiAccess) geo.push(extra.aiAccess);
  if (extra.llmsTxt) geo.push(extra.llmsTxt);
  // URL hijyeni (site geneli, ek fetch YOK — mevcut P dizisinden)
  if (sitewide) {
    const badUrls = urlHygieneBad(P);
    tech.push(siteCheck("URL hijyeni (site geneli)", badUrls, 10,
      "URL yapıları temiz", (n) => `${n} URL uzun/büyük harf/underscore/derin`, FIX["URL hijyeni (site geneli)"]!));
  }
  // ═══ GÜVENLİK (Seoyen: HTTPS & Güvenlik) ═══
  const security: Check[] = [];
  const isHttps = page.finalUrl.startsWith("https://");
  const mixed = isHttps ? Array.from(new Set((html.match(/(?:src|href)=["']http:\/\/[^"']+/gi) || [])
    .map((s) => s.replace(/^[^"']*["']/, "")).filter((u) => !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)))) : [];
  security.push(mixed.length > 0
    ? { label: "Karışık içerik (mixed content)", status: "warn", detail: `${mixed.length} kaynak http:// ile yükleniyor (HTTPS sayfada)`, urls: mixed.slice(0, URL_CAP), fix: "Tüm görsel/script/stil kaynaklarını https:// ile yükleyin; tarayıcı aksi halde engelleyebilir." }
    : { label: "Karışık içerik (mixed content)", status: "pass", detail: isHttps ? "Karışık içerik yok" : "Site HTTPS değil" });
  security.push(h("content-security-policy")
    ? { label: "Content-Security-Policy (CSP)", status: "pass", detail: "Tanımlı" }
    : { label: "Content-Security-Policy (CSP)", status: "warn", detail: "Yok — XSS/enjeksiyon koruması zayıf", fix: "Content-Security-Policy başlığı ekleyin." });
  security.push(h("x-frame-options") || /frame-ancestors/i.test(h("content-security-policy") || "")
    ? { label: "Clickjacking koruması (X-Frame-Options)", status: "pass", detail: h("x-frame-options") || "CSP frame-ancestors" }
    : { label: "Clickjacking koruması (X-Frame-Options)", status: "warn", detail: "Yok — sayfa iframe'e gömülebilir", fix: "X-Frame-Options: SAMEORIGIN veya CSP frame-ancestors ekleyin." });
  security.push(h("referrer-policy")
    ? { label: "Referrer-Policy", status: "pass", detail: h("referrer-policy")! }
    : { label: "Referrer-Policy", status: "warn", info: true, detail: "Tanımsız" });

  // ═══ ERİŞİLEBİLİRLİK (Seoyen: Erişilebilirlik) ═══
  const access: Check[] = [];
  access.push(has(/<html[^>]+\blang=/i)
    ? { label: "Dil etiketi (html lang)", status: "pass", detail: "Tanımlı" }
    : { label: "Dil etiketi (html lang)", status: "warn", detail: "Tanımsız — ekran okuyucular dili bilemez", fix: "<html lang=\"tr\"> ekleyin." });
  const inputCount = count(/<input\b(?![^>]*type=["'](?:hidden|submit|button|image|reset)["'])[^>]*>/gi) + count(/<textarea\b/gi) + count(/<select\b/gi);
  const labeledApprox = count(/\baria-label=|\baria-labelledby=|<label\b/gi);
  access.push(inputCount === 0
    ? { label: "Form etiketleri", status: "pass", info: true, detail: "Etkileşimli form alanı yok" }
    : labeledApprox >= inputCount
      ? { label: "Form etiketleri", status: "pass", detail: `${inputCount} form alanı etiketli görünüyor` }
      : { label: "Form etiketleri", status: "warn", detail: `${inputCount} form alanı var, ${labeledApprox} label/aria-label tespit edildi — bazıları etiketsiz olabilir`, fix: "Her input/select/textarea için <label> veya aria-label ekleyin." });
  access.push(has(/<main\b|<nav\b|role=["'](?:main|navigation|banner|contentinfo)["']/i)
    ? { label: "Semantik bölümler / ARIA landmark", status: "pass", detail: "main/nav/landmark mevcut" }
    : { label: "Semantik bölümler / ARIA landmark", status: "warn", detail: "Semantik bölüm (main/nav/header/footer) yok", fix: "İçeriği <header>, <nav>, <main>, <footer> ile sarın." });
  const emptyLinks = (html.match(/<a\b[^>]*>\s*(?:<[^>]+>\s*)*<\/a>/gi) || []).filter((a) => !/aria-label=/i.test(a) && !/<img[^>]+alt=["'][^"']+["']/i.test(a)).length;
  access.push(emptyLinks > 0
    ? { label: "Boş bağlantı metni", status: "warn", detail: `${emptyLinks} bağlantının erişilebilir metni yok — ekran okuyucular okuyamaz`, fix: "Bağlantıya görünür metin, aria-label veya alt'lı görsel ekleyin." }
    : { label: "Boş bağlantı metni", status: "pass", detail: "Bağlantı metinleri erişilebilir" });
  const imgNoAltPage = count(/<img(?![^>]*\balt=)[^>]*>/gi);
  access.push(imgNoAltPage === 0
    ? { label: "Görsel alt metni (erişilebilirlik)", status: "pass", detail: "Tüm görsellerde alt var (girilen sayfa)" }
    : { label: "Görsel alt metni (erişilebilirlik)", status: "warn", detail: `${imgNoAltPage} görselde alt eksik (girilen sayfa)`, fix: "Bilgi taşıyan görsellere alt, dekoratiflere alt=\"\" ekleyin." });

  // ═══ SITEMAP (Seoyen: Sitemap) ═══
  const sitemapChecks: Check[] = [];
  if (site) {
    sitemapChecks.push({ label: "Sitemap bulundu ve tarandı", status: "pass", detail: `Sitemap üzerinden ${N} URL keşfedildi` });
    const redir = P.filter((p) => p.redirected).length;
    sitemapChecks.push(redir === 0
      ? { label: "Sitemap URL geçerliliği", status: "pass", detail: "Sitemap URL'leri doğrudan yanıt veriyor" }
      : { label: "Sitemap URL geçerliliği", status: redir > Math.floor(N / 10) ? "warn" : "pass", detail: `${redir} URL yönleniyor (301/302)`, fix: "Sitemap'te nihai URL'leri listeleyin." });
  } else {
    sitemapChecks.push({ label: "Sitemap", status: "warn", info: true, detail: "Sitemap üzerinden çoklu sayfa taranamadı (tek sayfa modu veya sitemap yok)" });
  }

  // ═══ JS & CSS (Seoyen: JavaScript ve CSS) ═══
  const jscss: Check[] = [];
  const scriptCount = count(/<script\b[^>]*\bsrc=/gi);
  const inlineScript = count(/<script\b(?![^>]*\bsrc=)[^>]*>/gi);
  const cssCount = count(/<link[^>]+rel=["']stylesheet["']/gi);
  jscss.push({ label: "Harici script sayısı", status: scriptCount > 20 ? "warn" : "pass", info: scriptCount <= 20, detail: `${scriptCount} harici <script>${scriptCount > 20 ? " (fazla — HTTP istekleri artıyor)" : ""}` });
  jscss.push({ label: "Satır içi (inline) script", status: inlineScript > 15 ? "warn" : "pass", info: inlineScript <= 15, detail: `${inlineScript} inline <script>` });
  jscss.push({ label: "Harici CSS sayısı", status: cssCount > 8 ? "warn" : "pass", info: cssCount <= 8, detail: `${cssCount} stylesheet${cssCount > 8 ? " (fazla — render-blocking riski)" : ""}` });
  // Lighthouse fırsatlarından render-blocking / kullanılmayan kaynak sinyali
  const rb = lh.opportunities.find((o) => /render-blocking|kullanılmayan|unused|minif/i.test(o.title));
  if (rb) jscss.push({ label: "Render-blocking / kullanılmayan kaynaklar", status: "warn", detail: `${rb.title} — ${rb.value}`, fix: "Kritik olmayan JS/CSS'i erteleyin (defer/async), kullanılmayan kodu ayıklayın, minify edin." });

  // Grup içi sıralama: hata → uyarı → başarılı (info satırları en üstte kalır)
  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  const sortChecks = (arr: Check[]) => arr.sort((a, b) => (a.info ? -1 : b.info ? 1 : order[a.status] - order[b.status]));
  const groups: CheckGroup[] = [
    { id: "tech", title: `Teknik SEO & Taranabilirlik${scopeTag}`, checks: sortChecks(tech) },
    { id: "security", title: `HTTPS & Güvenlik${scopeTag}`, checks: sortChecks(security) },
    { id: "onpage", title: `Sayfa İçi SEO${scopeTag}`, checks: sortChecks(onpage) },
    { id: "access", title: `Erişilebilirlik${scopeTag}`, checks: sortChecks(access) },
    { id: "images", title: `Görseller${scopeTag}`, checks: sortChecks(images) },
    { id: "mobile", title: `Mobil Uyumluluk${scopeTag}`, checks: sortChecks(mobile) },
    { id: "geo", title: `GEO / Yapısal Veri${scopeTag}`, checks: sortChecks(geo) },
    { id: "jscss", title: "JavaScript & CSS · girilen sayfa", checks: sortChecks(jscss) },
    { id: "sitemap", title: `Sitemap${scopeTag}`, checks: sortChecks(sitemapChecks) },
    { id: "perf", title: "Performans (hız) · girilen sayfa", checks: sortChecks(perf) },
  ];
  return groups.filter((g) => g.checks.length > 0);
}
// ── Ana giriş noktası ──────────────────────────────────────────────────────
export async function auditSite(rawUrl: string): Promise<AuditResponse> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  let url = (rawUrl || "").trim();
  if (!url) return { ok: false, error: "URL boş" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  // 1) Mobil + Desktop PSI + girilen sayfa paralel (desktop hatası mobili bozmaz)
  const [lh, lhDesktop, page] = await Promise.all([
    fetchLighthouse(url, "mobile"),
    fetchLighthouse(url, "desktop"),
    fetchEnteredPage(url),
  ]);
  if (!lh.ok) return { ok: false, error: lh.error };
  if (!page.ok) return { ok: false, error: "Sayfa HTML'i alınamadı (zaman aşımı veya engel)." };
  // 2) Site tarama + görsel/link HEAD + redirect zinciri + robots + llms.txt paralel (mekanik crawler)
  const [site, imagesList, linksRes, redirectChain, robotsRes, llmsTxt, httpsRedirect] = await Promise.all([
    siteCrawl(page.origin, lh.finalUrl).catch(() => null),
    fetchImagesList(page.html, page.finalUrl).catch(() => [] as AuditData["imagesList"]),
    fetchLinksList(page.html, page.finalUrl, page.host).catch(() => ({ list: [], broken: [] as string[] })),
    fetchRedirectChain(url).catch(() => [] as { url: string; status: number }[]),
    safeFetchText(page.origin + "/robots.txt", 6000),
    fetchLlmsTxt(page.origin).catch(() => false),
    checkHttpsRedirect(page.finalUrl).catch(() => null),
  ]);
  // v3 türetmeler (girilen sayfanın html'inden — uydurma yok)
  const serp = { title: page.title, desc: page.desc, url: page.finalUrl };
  const social = extractSocial(page.html);
  const headings = extractHeadings(page.html);
  const contentStats = computeContentStats(page.html, page.text, page.words);
  const aiAccess = parseAiAccess(robotsRes.text || "");
  const perfDesktop = lhDesktop.ok ? { score: lhDesktop.perfScore, metrics: lhDesktop.metrics } : null;
  const crux = lh.crux;
  // Ek kontroller
  const brokenLinks: Check | null = linksRes.broken.length > 0
    ? { label: "Kırık linkler (girilen sayfa)", status: "fail", detail: `${linksRes.broken.length} bağlantı 4xx/5xx döndürüyor`, urls: linksRes.broken.slice(0, URL_CAP), fix: FIX["Kırık linkler (girilen sayfa)"] }
    : null;
  const chainUrls = redirectChain.map((s: { url: string; status: number }) => `${s.url} (${s.status})`);
  const hasLoop = redirectChain.length > 1 && new Set(redirectChain.map((s: { url: string; status: number }) => s.url)).size !== redirectChain.length;
  const redirectChainCheck: Check | null = hasLoop
    ? { label: "Yönlendirme döngüsü", status: "fail", detail: "Yönlendirme döngüsü tespit edildi", urls: chainUrls, fix: FIX["Yönlendirme döngüsü"] }
    : redirectChain.length > 1
      ? { label: "Yönlendirme zinciri", status: "warn", detail: `${redirectChain.length} adımlı yönlendirme zinciri`, urls: chainUrls, fix: FIX["Yönlendirme zinciri"] }
      : null;
  const blockedBots = aiAccess.filter((b) => !b.allowed).map((b) => b.bot);
  const aiAccessCheck: Check = blockedBots.length > 0
    ? { label: "AI bot erişimi", status: "warn", detail: `AI botlarına kapalı: ${blockedBots.join(", ")}`, fix: FIX["AI bot erişimi"] }
    : { label: "AI bot erişimi", status: "pass", detail: "AI botları (GPTBot, ClaudeBot, PerplexityBot…) engellenmemiş" };
  const llmsTxtCheck: Check = llmsTxt
    ? { label: "llms.txt", status: "pass", detail: "llms.txt mevcut" }
    : { label: "llms.txt", status: "warn", detail: "llms.txt yok (AI motorları için opsiyonel rehber)", fix: FIX["llms.txt"] };
  // 3) Grupları kur (site geneli bulgular kategorilere dağıtılmış halde)
  const groups = buildGroups(page, site, lh, { brokenLinks, redirectChain: redirectChainCheck, aiAccess: aiAccessCheck, llmsTxt: llmsTxtCheck, httpsRedirect });
  // Öneri metinlerini bağla (elle atanmamışsa)
  for (const g of groups) g.checks = g.checks.map((c) => ({ ...c, fix: c.fix ?? FIX[c.label] }));
  // 4) AI katmanı — mekanik bulgular TEK çağrıyla yorumlanır (site geneli), per-sayfa değil
  const geoModel = process.env.ANTHROPIC_GEO_MODEL || undefined;
  const siteStats = site ? buildSiteAgg(site.pages) : undefined;
  const seoFindings = buildSeoFindings(groups);
  const aiDiag: { error?: string } = {};
  let locale = "tr";
  try { locale = getLocale(); } catch { /* cookie yoksa tr */ }
  const [ai, seoPlan] = await Promise.all([
    analyzeContentAI({ url: lh.finalUrl, title: page.title ?? "", metaDescription: page.desc ?? "", pageText: page.text, siteStats }, { model: geoModel, diag: aiDiag, locale }).catch((e) => { aiDiag.error = "AI çağrısı başarısız: " + String(e?.message || e).slice(0, 160); return null; }),
    analyzeSeoActionPlan({ url: lh.finalUrl, findings: seoFindings }, { model: geoModel, locale }).catch(() => null),
  ]);
  const aiError = ai ? undefined : (aiDiag.error || "AI/GEO analizi yapılamadı.");
  // 5) Sağlık skoru — info satırları hariç, pass=1 warn=0.5 fail=0
  const allChecks = groups.flatMap((g) => g.checks);
  const scorable = allChecks.filter((c) => !c.info);
  const errors = scorable.filter((c) => c.status === "fail").length;
  const warnings = scorable.filter((c) => c.status === "warn").length;
  const passes = scorable.filter((c) => c.status === "pass").length;
  const total = scorable.length || 1;
  const health = Math.round((100 * (passes + warnings * 0.5)) / total);
  const infoCount = allChecks.filter((c) => c.info).length;
  const scores = computeCategoryScores(groups, ai);
  const crawlSummary = site
    ? {
        pages: site.pages.length,
        ok: site.pages.filter((p) => p.status >= 200 && p.status < 300).length,
        redirected: site.pages.filter((p) => p.redirected || (p.status >= 300 && p.status < 400)).length,
        broken: site.pages.filter((p) => p.status === 0 || p.status >= 400).length,
      }
    : undefined;
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
      aiError,
      serp,
      social,
      headings,
      contentStats,
      imagesList: imagesList ?? [],
      linksList: linksRes.list,
      perfDesktop,
      crux,
      aiAccess,
      llmsTxt,
      redirectChain,
      seoPlan,
      crawlSummary,
      infoCount,
      scores,
    },
  };
}

// ── Site geneli agregasyon: mekanik crawler bulgularını yüzdelerle özetle (Claude'a girdi) ──
function buildSiteAgg(pages: PageInfo[]): string {
  const N = pages.length;
  const live = pages.filter((p) => p.status > 0 && p.status < 400);
  const L = live.length || 1;
  const pct = (n: number) => Math.round((100 * n) / L);
  const avgWords = Math.round(live.reduce((a, p) => a + p.words, 0) / L);
  return [
    `Taranan sayfa sayısı: ${N} (erişilebilir: ${live.length})`,
    `Tek H1 olan sayfa: %${pct(live.filter((p) => p.h1 === 1).length)}`,
    `H1 hiç olmayan sayfa: %${pct(live.filter((p) => p.h1 === 0).length)}`,
    `Meta açıklaması olan sayfa: %${pct(live.filter((p) => p.desc).length)}`,
    `Başlığı (title) olan sayfa: %${pct(live.filter((p) => p.title).length)}`,
    `JSON-LD yapısal verisi olan sayfa: %${pct(live.filter((p) => p.jsonld).length)}`,
    `Organization şeması olan sayfa: %${pct(live.filter((p) => p.schemaOrg).length)}`,
    `Breadcrumb şeması olan sayfa: %${pct(live.filter((p) => p.schemaBreadcrumb).length)}`,
    `FAQ şeması olan sayfa: %${pct(live.filter((p) => p.schemaFaq).length)}`,
    `Canonical etiketi olan sayfa: %${pct(live.filter((p) => p.canonical).length)}`,
    `hreflang olan sayfa: %${pct(live.filter((p) => p.hreflang > 0).length)}`,
    `Ortalama kelime sayısı: ${avgWords}`,
    `200 kelimeden az (zayıf) içerikli sayfa: %${pct(live.filter((p) => p.words < 200).length)}`,
    `noindex olan sayfa: %${pct(live.filter((p) => p.noindex).length)}`,
  ].join("\n");
}

// ── Deterministik denetim bulgularını AI aksiyon planı için metne çevir ──
function buildSeoFindings(groups: CheckGroup[]): string {
  const lines: string[] = [];
  for (const g of groups) {
    for (const c of g.checks) {
      if (c.info || c.status === "pass") continue;
      const n = c.urls?.length;
      lines.push(`[${g.title.split(" · ")[0]}] ${c.label}: ${c.detail}${n ? ` (${n} sayfa)` : ""} [${c.status === "fail" ? "HATA" : "UYARI"}]`);
    }
  }
  return lines.join("\n");
}

// ═══ Site Takibi: kalıcı site listesi + tarama geçmişi + değişim analizi ═══
export interface AuditSite {
  id: string;
  url: string;
  name: string | null;
  created_at: string;
  last: { health: number; errors: number; warnings: number; created_at: string } | null;
}
interface IssueSig { key: string; label: string; status: CheckStatus; urlCount: number }
export interface ScanDiff {
  hasPrev: boolean;
  fixed: number; newer: number; ongoing: number;
  fixedItems: { label: string }[];
  newItems: { label: string }[];
}
export type RunScanResponse = { ok: true; data: AuditData; diff: ScanDiff } | { ok: false; error: string };

export async function listAuditSites(): Promise<AuditSite[]> {
  const profile = await getProfile();
  if (!profile) return [];
  const supabase = createClient();
  const { data: sites } = await supabase.from("audit_sites").select("id,url,name,created_at").order("created_at", { ascending: false });
  const { data: scans } = await supabase.from("audit_scans").select("site_id,health,errors,warnings,created_at").order("created_at", { ascending: false });
  const last = new Map<string, { health: number; errors: number; warnings: number; created_at: string }>();
  (scans ?? []).forEach((s: any) => { if (!last.has(s.site_id)) last.set(s.site_id, { health: s.health, errors: s.errors, warnings: s.warnings, created_at: s.created_at }); });
  return (sites ?? []).map((s: any) => ({ id: s.id, url: s.url, name: s.name, created_at: s.created_at, last: last.get(s.id) ?? null }));
}

export async function addAuditSite(url: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  let u = (url || "").trim();
  if (!u) return { ok: false, error: "URL boş" };
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const supabase = createClient();
  const { error } = await supabase.from("audit_sites").insert({ url: u, name: (name || "").trim() || null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAuditSite(id: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  const supabase = createClient();
  const { error } = await supabase.from("audit_sites").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function runSiteScan(siteId: string): Promise<RunScanResponse> {
  const profile = await getProfile();
  if (!profile || profile.role === "viewer") return { ok: false, error: "Yetkisiz" };
  const supabase = createClient();
  const { data: site } = await supabase.from("audit_sites").select("id,url").eq("id", siteId).single();
  if (!site) return { ok: false, error: "Site bulunamadı" };
  const res = await auditSite(site.url);
  if (!res.ok) return { ok: false, error: res.error };
  const data = res.data;
  const issues: IssueSig[] = data.groups.flatMap((g) =>
    g.checks.filter((c) => !c.info && c.status !== "pass").map((c) => ({ key: c.label, label: c.label, status: c.status, urlCount: c.urls?.length ?? 0 }))
  );
  const { data: prev } = await supabase.from("audit_scans").select("issues").eq("site_id", siteId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const prevIssues: IssueSig[] = (prev?.issues as IssueSig[]) ?? [];
  const hasPrev = !!prev;
  const curKeys = new Set(issues.map((i) => i.key));
  const prevKeys = new Set(prevIssues.map((i) => i.key));
  const fixedItems = prevIssues.filter((i) => !curKeys.has(i.key)).map((i) => ({ label: i.label }));
  const newItems = issues.filter((i) => !prevKeys.has(i.key)).map((i) => ({ label: i.label }));
  const ongoing = issues.filter((i) => prevKeys.has(i.key)).length;
  await supabase.from("audit_scans").insert({ site_id: siteId, health: data.health, errors: data.counts.errors, warnings: data.counts.warnings, passes: data.counts.passes, issues, report: data });
  return { ok: true, data, diff: { hasPrev, fixed: fixedItems.length, newer: newItems.length, ongoing, fixedItems, newItems } };
}

export interface ScanRow { id: string; health: number; errors: number; warnings: number; created_at: string }
export async function getScanHistory(siteId: string): Promise<ScanRow[]> {
  const profile = await getProfile();
  if (!profile) return [];
  const supabase = createClient();
  const { data } = await supabase.from("audit_scans").select("id,health,errors,warnings,created_at").eq("site_id", siteId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as ScanRow[];
}
export async function getScanReport(scanId: string): Promise<AuditData | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = createClient();
  const { data } = await supabase.from("audit_scans").select("report").eq("id", scanId).maybeSingle();
  return (data?.report as AuditData) ?? null;
}
export async function getLatestScanReport(siteId: string): Promise<AuditData | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = createClient();
  const { data } = await supabase.from("audit_scans").select("report").eq("site_id", siteId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.report as AuditData) ?? null;
}
