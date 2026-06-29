"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExecBadge } from "@/components/ui";
import { EXEC_TYPE_LABELS_TR } from "@/lib/types";
import type { Execution, ExecutionType, Market } from "@/lib/types";
import { createExecution, updateExecution, deleteExecution, uploadExecutionFile } from "./actions";

const TYPES: ExecutionType[] = ["audit", "schema", "redirect", "geo", "optimization"];
const inputCls =
  "rounded-bosch border border-surface-border bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-bosch-blue";

function Fields({ ex, markets, withMarket }: { ex?: Execution; markets: Market[]; withMarket: boolean }) {
  return (
    <>
      {withMarket && (
        <select name="market_id" defaultValue={ex?.market_id ?? markets[0]?.id} className={inputCls}>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code}
            </option>
          ))}
        </select>
      )}
      <select name="type" defaultValue={ex?.type ?? "audit"} className={inputCls}>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {EXEC_TYPE_LABELS_TR[t]}
          </option>
        ))}
      </select>
      <input name="description" defaultValue={ex?.description ?? ""} placeholder="Açıklama" className={`${inputCls} flex-1 min-w-[160px]`} />
      <input name="urls" defaultValue={ex?.urls ?? ""} placeholder="URL'ler" className={`${inputCls} flex-1 min-w-[120px]`} />
      <input name="due_date" type="date" defaultValue={ex?.due_date ?? ""} className={inputCls} />
      <select name="status" defaultValue={ex?.status ?? "todo"} className={inputCls}>
        <option value="todo">Yapılacak</option>
        <option value="in_progress">Devam</option>
        <option value="done">Tamamlandı</option>
      </select>
    </>
  );
}

function CreateForm({ markets }: { markets: Market[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-bosch bg-bosch-red px-4 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors"
      >
        + Yeni iş
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await createExecution(fd);
          setOpen(false);
          router.refresh();
        });
      }}
      className="flex flex-wrap items-center gap-2 bg-surface-muted border border-surface-border rounded-bosch p-3"
    >
      <Fields markets={markets} withMarket />
      <button type="submit" disabled={pending} className="rounded-bosch bg-bosch-red px-3 py-1.5 text-sm font-medium text-white hover:bg-bosch-red-hover disabled:opacity-60">
        {pending ? "Ekleniyor…" : "Ekle"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-body hover:text-ink">
        İptal
      </button>
    </form>
  );
}

function Row({ ex, markets }: { ex: Execution; markets: Market[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();

  function refresh() {
    router.refresh();
  }

  if (edit)
    return (
      <tr className="border-t border-surface-border bg-surface-muted/40">
        <td colSpan={6} className="px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                await updateExecution(ex.id, fd);
                setEdit(false);
                refresh();
              });
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Fields ex={ex} markets={markets} withMarket={false} />
            <button type="submit" disabled={pending} className="rounded-bosch bg-bosch-red px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              Kaydet
            </button>
            <button type="button" onClick={() => setEdit(false)} className="text-sm text-ink-body">
              İptal
            </button>
          </form>
        </td>
      </tr>
    );

  return (
    <tr className="border-t border-surface-border align-top">
      <td className="px-4 py-3 text-ink">{EXEC_TYPE_LABELS_TR[ex.type]}</td>
      <td className="px-4 py-3 text-ink-body">{ex.description}</td>
      <td className="px-4 py-3 text-bosch-blue text-xs break-all">{ex.urls}</td>
      <td className="px-4 py-3 text-ink-body whitespace-nowrap">{ex.due_date ?? "—"}</td>
      <td className="px-4 py-3">
        <ExecBadge status={ex.status} />
        {ex.output_file_url && (
          <a href={ex.output_file_url} target="_blank" rel="noreferrer" className="block text-xs text-bosch-blue hover:underline mt-1">
            çıktı dosyası ↗
          </a>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setEdit(true)} className="text-xs text-bosch-blue hover:underline">
            Düzenle
          </button>
          <label className="text-xs text-bosch-blue hover:underline cursor-pointer">
            {pending ? "…" : "Dosya"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("file", f);
                start(async () => {
                  await uploadExecutionFile(ex.id, fd);
                  refresh();
                });
              }}
            />
          </label>
          <button
            onClick={() => {
              if (!confirm("Bu iş silinsin mi?")) return;
              start(async () => {
                await deleteExecution(ex.id);
                refresh();
              });
            }}
            className="text-xs text-bosch-red hover:underline"
          >
            Sil
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ExecutionManager({ markets, executions }: { markets: Market[]; executions: Execution[] }) {
  return (
    <div>
      <div className="mb-5">
        <CreateForm markets={markets} />
      </div>
      <div className="space-y-8">
        {markets.map((m) => {
          const items = executions.filter((e) => e.market_id === m.id);
          if (items.length === 0) return null;
          return (
            <div key={m.id}>
              <h2 className="text-sm font-semibold text-ink mb-2">
                {m.code} · {m.name}
              </h2>
              <div className="border border-surface-border rounded-bosch overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-ink-body">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">Tip</th>
                      <th className="text-left font-medium px-4 py-2.5">Açıklama</th>
                      <th className="text-left font-medium px-4 py-2.5">URL</th>
                      <th className="text-left font-medium px-4 py-2.5">Tarih</th>
                      <th className="text-left font-medium px-4 py-2.5">Statü / çıktı</th>
                      <th className="text-left font-medium px-4 py-2.5">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((ex) => (
                      <Row key={ex.id} ex={ex} markets={markets} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
