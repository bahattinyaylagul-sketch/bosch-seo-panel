"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  translateGuidelineForMarket,
  saveGuidelineTranslation,
  approveGuidelineTranslation,
} from "./actions";
import DocView, { printDocument } from "@/components/DocView";
import { useT } from "@/components/LangProvider";
import { type GuidelineTranslation, type Market } from "@/lib/types";

const inputCls =
  "w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue disabled:bg-surface-muted disabled:text-ink-body";
const labelCls = "block text-xs text-ink-body mb-1";

export default function GuidelineTranslationPanel({
  market,
  guidelineId,
  translation,
  bodyHtml,
  canTranslate,
  canEdit,
}: {
  market: Market;
  guidelineId: string;
  translation: GuidelineTranslation | null;
  bodyHtml: string;
  canTranslate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"translate" | "save" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  const status = translation?.status ?? "draft";
  const statusColor =
    status === "approved" ? "text-bosch-green" : status === "translated" ? "text-bosch-blue" : "text-ink-body";
  const isEmpty = !translation || (status === "draft" && !translation.title);

  function run(kind: "translate" | "save" | "approve", fn: () => Promise<void>) {
    setError(null);
    setBusy(kind);
    start(async () => {
      try {
        await fn();
        if (kind === "save") setEdit(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Hata");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="bg-surface-muted border border-surface-border rounded-bosch p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <span className="inline-block rounded-bosch bg-bosch-blue px-1.5 py-0.5 text-xs text-white">{market.code}</span>
          {market.name}
        </h3>
        <span className={`text-xs font-medium ${statusColor}`}>{t(`status.${status}`)}</span>
      </div>

      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {!isEmpty && (
          <button
            onClick={() => printDocument(translation?.title || market.name, bodyHtml)}
            className="rounded-bosch border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted transition-colors"
          >
            ↓ {t("doc.download")}
          </button>
        )}
        {canTranslate && (
          <button
            onClick={() => run("translate", () => translateGuidelineForMarket(guidelineId, market.id))}
            disabled={pending}
            className="rounded-bosch border border-bosch-blue px-3 py-1.5 text-xs font-medium text-bosch-blue hover:bg-bosch-blue/10 transition-colors disabled:opacity-60"
          >
            {busy === "translate" ? t("btn.translating") : isEmpty ? t("btn.translate") : t("btn.retranslate")}
          </button>
        )}
        {canEdit && !isEmpty && (
          <button
            onClick={() => setEdit((v) => !v)}
            className="rounded-bosch border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted transition-colors"
          >
            {edit ? t("doc.view") : t("doc.edit")}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">{error}</p>
      )}

      {isEmpty ? (
        <p className="text-xs text-ink-body">{canTranslate ? t("tp.emptyAdmin") : t("tp.emptyOther")}</p>
      ) : edit && canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!translation) return;
            const fd = new FormData(e.currentTarget);
            run("save", () => saveGuidelineTranslation(translation.id, fd));
          }}
          className="space-y-3"
        >
          <div>
            <label className={labelCls}>{t("field.title")}</label>
            <input name="title" defaultValue={translation?.title ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("field.bodyMd")}</label>
            <textarea
              name="body"
              defaultValue={translation?.body ?? ""}
              rows={12}
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-bosch border border-surface-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted transition-colors disabled:opacity-60"
            >
              {busy === "save" ? t("btn.saving") : t("btn.saveEdit")}
            </button>
            <button
              type="button"
              onClick={() => translation && run("approve", () => approveGuidelineTranslation(translation.id))}
              disabled={pending || status === "approved"}
              className="rounded-bosch bg-bosch-green px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === "approve" ? t("btn.approving") : status === "approved" ? t("btn.approved") : t("btn.approve")}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-surface-border rounded-bosch p-4">
          <h4 className="text-base font-semibold text-ink mb-2">{translation?.title}</h4>
          <DocView bodyHtml={bodyHtml} empty={t("doc.empty")} />
          {canEdit && status !== "approved" && (
            <button
              type="button"
              onClick={() => translation && run("approve", () => approveGuidelineTranslation(translation.id))}
              disabled={pending}
              className="mt-3 rounded-bosch bg-bosch-green px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === "approve" ? t("btn.approving") : t("btn.approve")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
