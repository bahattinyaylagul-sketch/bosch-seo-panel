"use client";

import { useState } from "react";
import TranslationPanel from "./TranslationPanel";
import { useT } from "@/components/LangProvider";
import type { ContentTranslation, Market } from "@/lib/types";

export interface MarketPanel {
  market: Market;
  translation: ContentTranslation | null;
  canEdit: boolean;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-surface-border",
  translated: "bg-bosch-blue",
  approved: "bg-bosch-green",
};

export default function MarketTranslations({
  panels,
  contentId,
  canTranslate,
}: {
  panels: MarketPanel[];
  contentId: string;
  canTranslate: boolean;
}) {
  const t = useT();
  const [active, setActive] = useState(0);

  if (panels.length === 0) {
    return <p className="text-sm text-ink-body">{t("tp.noMarket")}</p>;
  }

  const sel = panels[Math.min(active, panels.length - 1)];

  return (
    <div>
      {/* Pazar / dil seçici */}
      <div className="flex flex-wrap gap-2 mb-4">
        {panels.map((p, i) => {
          const status = p.translation?.status ?? "draft";
          const isActive = i === active;
          return (
            <button
              key={p.market.id}
              onClick={() => setActive(i)}
              className={[
                "flex items-center gap-2 rounded-bosch border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-bosch-red bg-surface-muted text-ink font-medium"
                  : "border-surface-border bg-white text-ink-body hover:bg-surface-muted",
              ].join(" ")}
            >
              <span className="inline-block rounded-bosch bg-bosch-blue px-1.5 py-0.5 text-xs text-white">
                {p.market.code}
              </span>
              <span>{p.market.name}</span>
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} title={t(`status.${status}`)} />
            </button>
          );
        })}
      </div>

      {/* Seçili pazarın paneli */}
      <TranslationPanel
        key={sel.market.id}
        market={sel.market}
        contentId={contentId}
        translation={sel.translation}
        canTranslate={canTranslate}
        canEdit={sel.canEdit}
      />
    </div>
  );
}
