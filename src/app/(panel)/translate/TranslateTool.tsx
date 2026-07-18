"use client";

import { useState, useTransition } from "react";
import { translateFreeText } from "./actions";
import { useT } from "@/components/LangProvider";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

const inputCls =
  "w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue";

export default function TranslateTool() {
  const t = useT();
  const [text, setText] = useState("");
  const [target, setTarget] = useState<Locale>("en");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    if (!text.trim()) {
      setError(t("tr.empty"));
      return;
    }
    setError(null);
    setResult("");
    start(async () => {
      try {
        const out = await translateFreeText(text, target);
        setResult(out);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Hata");
      }
    });
  }

  function copy() {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Kaynak */}
      <div>
        <label className="block text-xs text-ink-body mb-1">{t("tr.source")}</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={t("tr.source")}
          className={`${inputCls} font-mono text-xs`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-ink-body mb-1">{t("tr.target")}</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as Locale)}
              className="rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()} · {LOCALE_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={run}
            disabled={pending}
            className="self-end rounded-bosch bg-bosch-red px-5 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60"
          >
            {pending ? t("btn.translating") : t("btn.translate")}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-xs text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">{error}</p>
        )}
      </div>

      {/* Sonuç */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-ink-body">{t("tr.result")}</label>
          {result && (
            <button onClick={copy} className="text-xs text-bosch-blue hover:underline">
              {copied ? t("tr.copied") : t("tr.copy")}
            </button>
          )}
        </div>
        <div className="bg-surface-muted border border-surface-border rounded-bosch p-3 min-h-[18rem] text-sm text-ink whitespace-pre-wrap">
          {pending ? <span className="text-ink-body">{t("btn.translating")}</span> : result}
        </div>
      </div>
    </div>
  );
}
