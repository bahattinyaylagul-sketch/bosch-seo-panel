import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
// Yapılandırılan model geçersiz/erişilemezse denenecek bilinen çalışan modeller
const FALLBACK_MODELS = ["claude-sonnet-4-6", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"];

export interface ScoredDim {
  key: string;
  label: string;
  score: number; // 0-100
  note: string;
}
export interface AiAnalysis {
  overall: number; // 0-100
  summary: string;
  contentQuality: ScoredDim[]; // search intent, topical, semantic, info gain
  eeat: ScoredDim[]; // experience, expertise, authority, trust
  aiVisibility: ScoredDim[]; // citation likelihood, passage/chunk, direct answer
  geo: ScoredDim[]; // llm readability, fact density, entity density, question coverage
  entities: string[]; // sayfada geçen ana varlıklar
  missingEntities: string[]; // eksik / önerilen varlıklar
}

const clamp = (n: any): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
};
const str = (s: any): string => (typeof s === "string" ? s : "");

function dim(key: string, label: string, obj: any): ScoredDim {
  return { key, label, score: clamp(obj?.score), note: str(obj?.note).slice(0, 200) };
}

export async function analyzeContentAI(input: {
  url: string;
  title: string;
  metaDescription: string;
  pageText: string;
  siteStats?: string; // site geneli agregat bulgular (yüzdeler) — verilirse tüm site yorumlanır
}, opts?: { model?: string; diag?: { error?: string } }): Promise<AiAnalysis | null> {
  const diag = opts?.diag;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { if (diag) diag.error = "ANTHROPIC_API_KEY tanımlı değil — Vercel ortam değişkenlerine ekleyip yeniden deploy edin."; return null; }

  const model = opts?.model || MODEL;
  const client = new Anthropic({ apiKey });
  const text = (input.pageText || "").slice(0, 8000);
  if (text.replace(/\s/g, "").length < 60) { if (diag) diag.error = "Girilen sayfadan yeterli metin çıkarılamadı (JS ile render ediliyor olabilir)."; return null; }

  const system = [
    "Sen kıdemli bir SEO + GEO (Generative Engine Optimization) analistisin.",
    "Sana bir web sayfasının başlığı, meta açıklaması ve görünür metni verilecek.",
    "Bu içeriği KLASİK SEO ve AI/LLM görünürlüğü açısından değerlendir.",
    "Her boyut için 0-100 arası bir skor ve TEK cümlelik kısa, somut Türkçe not ver.",
    "Skorlar gerçekçi olsun; içerik zayıfsa düşük ver. Abartma.",
    "SADECE verilen sayfa metnine, başlığa ve meta açıklamaya dayan. Verilmeyen hiçbir bilgiyi (trafik, sıralama, backlink, rakip, tarih, istatistik, URL) üretme; bilmiyorsan alanı boş bırak. Yanıtı SADECE geçerli JSON olarak ver.",
    input.siteStats
      ? "Sana ayrıca SİTE GENELİ agregat bulgular (yüzdelerle) verildi. Değerlendirmeni tek sayfaya değil TÜM SİTEYE göre yap. Bu sayıları SEN ÜRETME; verilen istatistikleri yorumla. Örnek sayfa metni sadece ton/derinlik için temsilîdir."
      : "",
    "SADECE şu JSON şemasıyla yanıt ver, başka hiçbir metin ekleme:",
    JSON.stringify({
      overall: "number 0-100",
      summary: "string (1-2 cümle genel değerlendirme, Türkçe)",
      contentQuality: {
        searchIntent: { score: "number", note: "string" },
        topicalCoverage: { score: "number", note: "string" },
        semanticRichness: { score: "number", note: "string" },
        informationGain: { score: "number", note: "string" },
      },
      eeat: {
        experience: { score: "number", note: "string" },
        expertise: { score: "number", note: "string" },
        authoritativeness: { score: "number", note: "string" },
        trust: { score: "number", note: "string" },
      },
      aiVisibility: {
        citationLikelihood: { score: "number", note: "string" },
        passageQuality: { score: "number", note: "string" },
        directAnswerScore: { score: "number", note: "string" },
        chunkQuality: { score: "number", note: "string" },
      },
      geo: {
        llmReadability: { score: "number", note: "string" },
        factDensity: { score: "number", note: "string" },
        entityDensity: { score: "number", note: "string" },
        questionCoverage: { score: "number", note: "string" },
      },
      entities: ["string (sayfadaki ana varlık/kavramlar, en fazla 10)"],
      missingEntities: ["string (konuyu güçlendirecek eksik varlıklar, en fazla 8)"],
    }),
  ].join("\n");

  const payload = JSON.stringify({
    url: input.url,
    title: input.title,
    meta_description: input.metaDescription,
    ...(input.siteStats ? { site_geneli_agregat_bulgular: input.siteStats } : {}),
    page_text: text,
  });

  // Yapılandırılan modeli dene; model hatası olursa bilinen modellere sırayla düş
  const tryModels = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let raw = "";
  let lastErr: any = null;
  for (const m of tryModels) {
    try {
      const msg = await client.messages.create({
        model: m,
        max_tokens: 1600,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: payload }],
      });
      raw = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.statusCode;
      // 404/400 = model geçersiz → sıradaki modeli dene; diğer hatalar (401/429) tekrar denemeye değmez
      if (status === 404 || status === 400) continue;
      break;
    }
  }
  if (lastErr) {
    if (diag) diag.error = "AI çağrısı başarısız: " + String(lastErr?.message || lastErr).slice(0, 160) + " (model adı/API key/kotayı kontrol edin).";
    return null;
  }

  let j: any;
  try {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
    j = JSON.parse(s);
  } catch {
    if (diag) diag.error = "AI yanıtı JSON olarak çözümlenemedi.";
    return null;
  }

  // Şema-uyum guard'ı: zorunlu alanlar yoksa kısmi/uydurma nesne kurma, null dön
  if (!j || typeof j !== "object" || typeof j.overall !== "number" ||
      j.contentQuality == null || j.eeat == null || j.aiVisibility == null || j.geo == null) {
    if (diag) diag.error = "AI yanıtı beklenen şemada gelmedi.";
    return null;
  }

  const cq = j.contentQuality ?? {};
  const ee = j.eeat ?? {};
  const av = j.aiVisibility ?? {};
  const geo = j.geo ?? {};

  return {
    overall: clamp(j.overall),
    summary: str(j.summary).slice(0, 400),
    contentQuality: [
      dim("searchIntent", "Arama niyeti uyumu", cq.searchIntent),
      dim("topicalCoverage", "Konu kapsamı", cq.topicalCoverage),
      dim("semanticRichness", "Anlamsal zenginlik", cq.semanticRichness),
      dim("informationGain", "Bilgi kazancı (özgünlük)", cq.informationGain),
    ],
    eeat: [
      dim("experience", "Deneyim (Experience)", ee.experience),
      dim("expertise", "Uzmanlık (Expertise)", ee.expertise),
      dim("authoritativeness", "Otorite (Authority)", ee.authoritativeness),
      dim("trust", "Güven (Trust)", ee.trust),
    ],
    aiVisibility: [
      dim("citationLikelihood", "Alıntılanma ihtimali", av.citationLikelihood),
      dim("passageQuality", "Pasaj kalitesi", av.passageQuality),
      dim("directAnswerScore", "Doğrudan cevap skoru", av.directAnswerScore),
      dim("chunkQuality", "Chunk (parça) kalitesi", av.chunkQuality),
    ],
    geo: [
      dim("llmReadability", "LLM okunabilirliği", geo.llmReadability),
      dim("factDensity", "Bilgi/olgu yoğunluğu", geo.factDensity),
      dim("entityDensity", "Varlık yoğunluğu", geo.entityDensity),
      dim("questionCoverage", "Soru kapsamı", geo.questionCoverage),
    ],
    entities: Array.isArray(j.entities) ? j.entities.filter((x: any) => typeof x === "string").slice(0, 10) : [],
    missingEntities: Array.isArray(j.missingEntities) ? j.missingEntities.filter((x: any) => typeof x === "string").slice(0, 8) : [],
  };
}

// ── SEO Aksiyon Planı: deterministik bulguları TEK çağrıyla yorumla ─────────
export interface SeoAction { title: string; why: string; priority: "yüksek" | "orta" | "düşük" }
export interface SeoActionPlan { summary: string; actions: SeoAction[] }
export async function analyzeSeoActionPlan(
  input: { url: string; findings: string },
  opts?: { model?: string }
): Promise<SeoActionPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!input.findings || input.findings.trim().length < 10) return null;
  const model = opts?.model || MODEL;
  const client = new Anthropic({ apiKey });
  const system = [
    "Sen kıdemli bir teknik SEO danışmanısın.",
    "Sana bir sitenin DETERMİNİSTİK denetim bulguları (gerçek, doğrulanmış sayılarla) verilecek.",
    "Bu bulguları YORUMLA ve öncelikli, uygulanabilir bir aksiyon planı çıkar.",
    "Yeni sayı, URL, istatistik, trafik veya sıralama verisi ÜRETME. Sadece verilen bulgulara dayan; bilmiyorsan uydurma.",
    "Aynı kök nedene işaret eden bulguları grupla (ör. şablon/template kaynaklı toplu eksiklik). En fazla 7 aksiyon.",
    "Her aksiyona öncelik ata: 'yüksek' | 'orta' | 'düşük'. Türkçe yaz.",
    "SADECE şu JSON ile yanıt ver, başka hiçbir metin ekleme:",
    JSON.stringify({ summary: "string (1-2 cümle genel durum)", actions: [{ title: "string", why: "string (neden önemli / hangi bulgudan)", priority: "yüksek|orta|düşük" }] }),
  ].join("\n");
  const tryModels = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let raw = "";
  let lastErr: any = null;
  for (const m of tryModels) {
    try {
      const msg = await client.messages.create({
        model: m,
        max_tokens: 1400,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: input.findings.slice(0, 8000) }],
      });
      raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.statusCode;
      if (status === 404 || status === 400) continue;
      break;
    }
  }
  if (lastErr) return null;
  let j: any;
  try {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) s = fence[1].trim();
    const a = s.indexOf("{"); const b = s.lastIndexOf("}"); if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
    j = JSON.parse(s);
  } catch { return null; }
  if (!j || typeof j.summary !== "string" || !Array.isArray(j.actions)) return null;
  const actions: SeoAction[] = j.actions
    .filter((x: any) => x && typeof x.title === "string")
    .slice(0, 7)
    .map((x: any) => ({
      title: String(x.title).slice(0, 160),
      why: typeof x.why === "string" ? x.why.slice(0, 240) : "",
      priority: x.priority === "yüksek" || x.priority === "orta" || x.priority === "düşük" ? x.priority : "orta",
    }));
  if (!actions.length) return null;
  return { summary: j.summary.slice(0, 400), actions };
}
