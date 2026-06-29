"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContent } from "../actions";
import { useT } from "@/components/LangProvider";
import type { Content } from "@/lib/types";

const inputCls =
  "w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue disabled:bg-surface-muted disabled:text-ink-body";
const labelCls = "block text-xs text-ink-body mb-1";

export default function SourceEditor({
  content,
  editable,
}: {
  content: Content;
  editable: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateContent(content.id, fd);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-surface-muted border border-surface-border rounded-bosch p-4 space-y-3"
    >
      <div>
        <label className={labelCls}>{t("field.title")}</label>
        <input name="title" defaultValue={content.title} disabled={!editable} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("field.keyword")}</label>
          <input
            name="target_keyword"
            defaultValue={content.target_keyword ?? ""}
            disabled={!editable}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t("field.slug")}</label>
          <input name="slug" defaultValue={content.slug ?? ""} disabled={!editable} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t("field.metaTitle")}</label>
        <input
          name="meta_title"
          defaultValue={content.meta_title ?? ""}
          disabled={!editable}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>{t("field.metaDesc")}</label>
        <textarea
          name="meta_description"
          defaultValue={content.meta_description ?? ""}
          disabled={!editable}
          rows={2}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>{t("field.schemaType")}</label>
        <select
          name="schema_type"
          defaultValue={content.schema_type}
          disabled={!editable}
          className={inputCls}
        >
          <option value="Article">Article</option>
          <option value="Product">Product</option>
          <option value="FAQ">FAQ</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>{t("field.bodyMd")}</label>
        <textarea
          name="body"
          defaultValue={content.body ?? ""}
          disabled={!editable}
          rows={10}
          className={`${inputCls} font-mono text-xs`}
        />
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-bosch bg-bosch-red px-4 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60"
          >
            {pending ? t("btn.saving") : t("btn.save")}
          </button>
          {saved && <span className="text-xs text-bosch-green">{t("btn.saved")}</span>}
        </div>
      )}
    </form>
  );
}
