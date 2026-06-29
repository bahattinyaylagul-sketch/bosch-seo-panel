import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export interface TranslatableContent {
  title?: string | null;
  target_keyword?: string | null;
  slug?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  body?: string | null;
}

export interface TranslatedFields {
  title: string;
  target_keyword: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  body: string;
}

// SEO içeriğini hedef dile çevirir. keyword & slug için lokal düzenleme gerektiği not edilir.
export async function translateContent(
  source: TranslatableContent,
  targetLocale: string,
  targetName: string
): Promise<TranslatedFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY tanımlı değil. .env dosyasını kontrol edin.");
  }

  const client = new Anthropic({ apiKey });

  const system = [
    "Sen bir SEO lokalizasyon uzmanısın.",
    `Kaynak içeriği Türkçeden ${targetName} (${targetLocale}) diline çevir.`,
    "Kurallar:",
    "- meta_title, meta_description ve body: hedef pazara doğal, akıcı çeviri.",
    "- target_keyword: hedef dile çevir, ANCAK bu arama hacmine göre lokal düzenleme gerektirir.",
    "- slug: hedef dile uygun, kısa, tireli, küçük harf URL parçası üret; lokal düzenleme gerektirir.",
    "- Marka adlarını (Bosch) değiştirme.",
    "- Markdown yapısını koru.",
    "SADECE şu JSON şemasıyla yanıt ver, başka metin ekleme:",
    '{"title": string, "target_keyword": string, "slug": string, "meta_title": string, "meta_description": string, "body": string}',
  ].join("\n");

  const userPayload = JSON.stringify({
    title: source.title ?? "",
    target_keyword: source.target_keyword ?? "",
    slug: source.slug ?? "",
    meta_title: source.meta_title ?? "",
    meta_description: source.meta_description ?? "",
    body: source.body ?? "",
  });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPayload }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseJsonLoose(text);
}

// Guideline (markdown doküman) çevirisi — başlık + gövde.
export async function translateDoc(
  source: { title?: string | null; body?: string | null },
  targetLocale: string,
  targetName: string
): Promise<{ title: string; body: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY tanımlı değil. .env dosyasını kontrol edin.");

  const client = new Anthropic({ apiKey });
  const system = [
    "Sen bir teknik dokümantasyon çevirmenisin.",
    `Kaynağı Türkçeden ${targetName} (${targetLocale}) diline çevir.`,
    "Markdown yapısını ve kod bloklarını koru. Marka adlarını (Bosch, schema.org) değiştirme.",
    "SADECE şu JSON ile yanıt ver:",
    '{"title": string, "body": string}',
  ].join("\n");
  const payload = JSON.stringify({ title: source.title ?? "", body: source.body ?? "" });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: payload }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = parseJsonLooseRaw(text);
  return { title: parsed.title ?? "", body: parsed.body ?? "" };
}

function parseJsonLooseRaw(text: string): Record<string, string> {
  let raw = text.trim();
  // Olası ```json ... ``` çitlerini temizle
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

function parseJsonLoose(text: string): TranslatedFields {
  const parsed = parseJsonLooseRaw(text);
  return {
    title: parsed.title ?? "",
    target_keyword: parsed.target_keyword ?? "",
    slug: parsed.slug ?? "",
    meta_title: parsed.meta_title ?? "",
    meta_description: parsed.meta_description ?? "",
    body: parsed.body ?? "",
  };
}
