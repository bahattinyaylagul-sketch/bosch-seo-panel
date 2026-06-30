"use client";

// Markdown'dan render edilmiş bir dokümanı okunur halde gösterir
// ve Bosch logolu, baskıya hazır bir PDF olarak indirmeye izin verir.
export function printDocument(title: string, bodyHtml: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  const safeTitle = title || "Bosch";
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8" />
<title>${escapeHtml(safeTitle)}</title>
<style>
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #525252; margin: 0; }
  .bar { height: 4px; width: 100%; background: linear-gradient(to right,#18837E 0%,#00884A 28%,#007BC0 55%,#ED0007 80%,#9E2896 100%); }
  .wrap { padding: 24px 8px; max-width: 800px; margin: 0 auto; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #ECECEC; padding-bottom: 14px; margin-bottom: 22px; }
  .head img { height: 30px; width: auto; }
  .head .meta { font-size: 12px; color: #525252; }
  h1 { color: #000; font-size: 22px; font-weight: 600; margin: 0 0 14px; }
  h2 { color: #000; font-size: 18px; font-weight: 600; margin: 18px 0 8px; }
  h3 { color: #000; font-size: 15px; font-weight: 600; margin: 14px 0 6px; }
  p { line-height: 1.7; margin: 8px 0; }
  ul, ol { padding-left: 22px; margin: 8px 0; line-height: 1.7; }
  code { background: #F5F5F5; padding: 1px 5px; border-radius: 2px; font-size: 0.9em; }
  pre { background: #F5F5F5; padding: 12px; border-radius: 2px; overflow:auto; }
  .foot { margin-top: 28px; border-top: 1px solid #ECECEC; padding-top: 10px; font-size: 11px; color: #888; display:flex; justify-content:space-between; }
</style></head>
<body>
  <div class="bar"></div>
  <div class="wrap">
    <div class="head">
      <img src="${origin}/bosch-logo.png" alt="BOSCH" />
      <span class="meta">NextCode × Bosch Aftermarket · Global SEO Paneli</span>
    </div>
    <h1>${escapeHtml(safeTitle)}</h1>
    <div class="body">${bodyHtml}</div>
    <div class="foot"><span>© Bosch Sanayi ve Ticaret A.Ş</span><span>NextCode Collective</span></div>
  </div>
</body></html>`);
  w.document.close();
  // Logo yüklensin sonra yazdır
  setTimeout(() => {
    w.focus();
    w.print();
  }, 350);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export default function DocView({ bodyHtml, empty }: { bodyHtml: string; empty: string }) {
  if (!bodyHtml.trim()) {
    return <p className="text-xs text-ink-body">{empty}</p>;
  }
  return (
    <div
      className="prose-bosch text-sm text-ink-body"
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
