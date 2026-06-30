"use client";

import { useState } from "react";
import GuidelineEditor from "./GuidelineEditor";
import DocView, { printDocument } from "@/components/DocView";
import { useT } from "@/components/LangProvider";
import type { Guideline } from "@/lib/types";

export default function GuidelineSource({
  guideline,
  bodyHtml,
  editable,
}: {
  guideline: Guideline;
  bodyHtml: string;
  editable: boolean;
}) {
  const t = useT();
  const [edit, setEdit] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <span className="inline-block rounded-bosch bg-bosch-red px-1.5 py-0.5 text-xs text-white">TR</span>
          {t("gl.source")}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printDocument(guideline.title, bodyHtml)}
            className="rounded-bosch border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted transition-colors"
          >
            ↓ {t("doc.download")}
          </button>
          {editable && (
            <button
              onClick={() => setEdit((v) => !v)}
              className="rounded-bosch border border-bosch-blue px-3 py-1.5 text-xs font-medium text-bosch-blue hover:bg-bosch-blue/10 transition-colors"
            >
              {edit ? t("doc.view") : t("doc.edit")}
            </button>
          )}
        </div>
      </div>

      {edit ? (
        <GuidelineEditor guideline={guideline} editable={editable} />
      ) : (
        <div className="bg-surface-muted border border-surface-border rounded-bosch p-5">
          <h3 className="text-lg font-semibold text-ink mb-3">{guideline.title}</h3>
          <DocView bodyHtml={bodyHtml} empty={t("doc.empty")} />
        </div>
      )}
    </div>
  );
}
