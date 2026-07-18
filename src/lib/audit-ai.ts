import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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
}): Promise<AiAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const text = (input.pageText || "").slice(0, 8000);
  if (text.replace(/\s/g, "").length < 60) return null; // içerik yok

  const system = [
    "Sen kıdemli bir SEO + GEO (Generative Engine Optimization) analistisin.",
    "Sana bir web sayfasının başlığı, meta açıklaması ve görünür metni verilecek.",
    "Bu içeriği KLASİK SEO ve AI/LLM görünürlüğü açısından değerlendir.",
    "Her boyut için 0-100 arası bir skor ve TEK cümlelik kısa, somut Türkçe not ver.",
    "Skorlar gerçekçi olsun; içerik zayıfsa düşük ver. Abartma.",
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
    page_text: text,
  });

  let raw = "";
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1600,
      system,
      messages: [{ role: "user", content: payload }],
    });
    raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch {
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
