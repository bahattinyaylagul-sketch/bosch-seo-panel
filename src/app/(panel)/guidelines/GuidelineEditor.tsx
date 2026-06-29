"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGuideline } from "./actions";
import type { Guideline } from "@/lib/types";

const inputCls =
  "w-full rounded-bosch border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bosch-blue disabled:bg-surface-muted disabled:text-ink-body";
const labelCls = "block text-xs text-ink-body mb-1";

export default function GuidelineEditor({ guideline, editable }: { guideline: Guideline; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateGuideline(guideline.id, fd);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface-muted border border-surface-border rounded-bosch p-4 space-y-3">
      <div>
        <label className={labelCls}>Başlık</label>
        <input name="title" defaultValue={guideline.title} disabled={!editable} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Kategori</label>
        <input
          name="category"
          defaultValue={guideline.category ?? ""}
          disabled={!editable}
          placeholder="teknik standart / schema kuralı / GEO"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Gövde (markdown)</label>
        <textarea
          name="body"
          defaultValue={guideline.body ?? ""}
          disabled={!editable}
          rows={14}
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
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {saved && <span className="text-xs text-bosch-green">Kaydedildi ✓</span>}
        </div>
      )}
    </form>
  );
}
