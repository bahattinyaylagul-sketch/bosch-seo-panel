import { marked } from "marked";

// Markdown → HTML (admin tarafından yazılan iç içerik; sunucuda render edilir)
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  return marked.parse(md, { async: false }) as string;
}
