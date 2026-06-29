"use client";

import { useState } from "react";
import GuidelineTranslationPanel from "./GuidelineTranslationPanel";
import { useT } from "@/components/LangProvider";
import type { GuidelineTranslation, Market } from "@/lib/types";

export interface GuidelinePanel {
  market: Market;
  translation: GuidelineTranslation | null;
  canEdit: boolean;
}

export default function GuidelineMarketTranslations({
  panels,
  guidelineId,
  canTranslate,
}: {
  panels: GuidelinePanel[];
  guidelineId: string;
  canTranslate: boolean;
}) {
  const t = useT();
  const [active, setActive] = useState(0);

  if (panels.length === 0) {
    return <p className="text-sm text-ink-body">{t("gl.noMarket")}</p>;
  }

  const idx = Math.min(active, panels.length - 1);
  const sel = panels[idx];

  return (
    <div>
      <div className="mb-4">
        <label className="block text-xs text-ink-body mb-1">{t("tp.selectMarket")}</label>
        <select
          value={idx}
          onChange={(e) => setActive(Number(e.target.value))}
          className="w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue"
        >
          {panels.map((p, i) => {
            const status = p.translation?.status ?? "draft";
            return (
              <option key={p.market.id} value={i}>
                {p.market.code} · {p.market.name} — {t(`status.${status}`)}
              </option>
            );
          })}
        </select>
      </div>

      <GuidelineTranslationPanel
        key={sel.market.id}
        market={sel.market}
        guidelineId={guidelineId}
        translation={sel.translation}
        canTranslate={canTranslate}
        canEdit={sel.canEdit}
      />
    </div>
  );
}
