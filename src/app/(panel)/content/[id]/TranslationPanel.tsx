"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { translateForMarket, saveTranslation, approveTranslation } from "../actions";
import { useT } from "@/components/LangProvider";
import { type ContentTranslation, type Market } from "@/lib/types";

const inputCls =
  "w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue disabled:bg-surface-muted disabled:text-ink-body";
const labelCls = "block text-xs text-ink-body mb-1";

export default function TranslationPanel({
  market,
  contentId,
  translation,
  canTranslate,
  canEdit,
}: {
  market: Market;
  contentId: string;
  translation: ContentTranslation | null;
  canTranslate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"translate" | "save" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = translation?.status ?? "draft";
  const needsReview = translation?.needs_local_review ?? true;
  const statusColor =
    status === "approved" ? "text-bosch-green" : status === "translated" ? "text-bosch-blue" : "text-ink-body";

  function doTranslate() {
    setError(null);
    setBusy("translate");
    start(async () => {
      try {
        await translateForMarket(contentId, market.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Çeviri hatası");
      } finally {
        setBusy(null);
      }
    });
  }

  function doSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!translation) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    setBusy("save");
    start(async () => {
      try {
        await saveTranslation(translation.id, fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kayıt hatası");
      } finally {
        setBusy(null);
      }
    });
  }

  function doApprove() {
    if (!translation) return;
    setError(null);
    setBusy("approve");
    start(async () => {
      try {
        await approveTranslation(translation.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Onay hatası");
      } finally {
        setBusy(null);
      }
    });
  }

  const isEmpty = !translation || (status === "draft" && !translation.title);

  return (
    <div className="bg-surface-muted border border-surface-border rounded-bosch p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <span className="inline-block rounded-bosch bg-bosch-blue px-1.5 py-0.5 text-xs text-white">
            {market.code}
          </span>
          {market.name}
        </h3>
        <span className={`text-xs font-medium ${statusColor}`}>{t(`status.${status}`)}</span>
      </div>

      {canTranslate && (
        <button
          onClick={doTranslate}
          disabled={pending}
          className="mb-3 rounded-bosch border border-bosch-blue px-3 py-1.5 text-xs font-medium text-bosch-blue hover:bg-bosch-blue/10 transition-colors disabled:opacity-60"
        >
          {busy === "translate" ? t("btn.translating") : isEmpty ? t("btn.translate") : t("btn.retranslate")}
        </button>
      )}

      {error && (
        <p className="mb-3 text-xs text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-2">
          {error}
        </p>
      )}

      {isEmpty ? (
        <p className="text-xs text-ink-body">
          {canTranslate ? t("tp.emptyAdmin") : t("tp.emptyOther")}
        </p>
      ) : (
        <form onSubmit={doSave} className="space-y-3">
          <div>
            <label className={labelCls}>{t("field.title")}</label>
            <input name="title" defaultValue={translation?.title ?? ""} disabled={!canEdit} className={inputCls} />
          </div>

          {needsReview && (
            <p className="text-xs text-bosch-red bg-white border border-bosch-red/30 rounded-bosch px-3 py-1.5">
              {t("tp.needsReview")}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t("field.keyword")}</label>
              <input
                name="target_keyword"
                defaultValue={translation?.target_keyword ?? ""}
                disabled={!canEdit}
                className={`${inputCls} ${needsReview ? "border-bosch-red/50" : ""}`}
              />
            </div>
            <div>
              <label className={labelCls}>{t("field.slug")}</label>
              <input
                name="slug"
                defaultValue={translation?.slug ?? ""}
                disabled={!canEdit}
                className={`${inputCls} ${needsReview ? "border-bosch-red/50" : ""}`}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("field.metaTitle")}</label>
            <input name="meta_title" defaultValue={translation?.meta_title ?? ""} disabled={!canEdit} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("field.metaDesc")}</label>
            <textarea
              name="meta_description"
              defaultValue={translation?.meta_description ?? ""}
              disabled={!canEdit}
              rows={2}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("field.body")}</label>
            <textarea
              name="body"
              defaultValue={translation?.body ?? ""}
              disabled={!canEdit}
              rows={8}
              className={`${inputCls} font-mono text-xs`}
            />
          </div>

          {canEdit && (
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
                onClick={doApprove}
                disabled={pending || status === "approved"}
                className="rounded-bosch bg-bosch-green px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy === "approve" ? t("btn.approving") : status === "approved" ? t("btn.approved") : t("btn.approve")}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
