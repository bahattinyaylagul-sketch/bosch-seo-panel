"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Market } from "@/lib/types";

export default function ContentFilters({ markets }: { markets: Market[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/content?${next.toString()}`);
  }

  const selectCls =
    "rounded-bosch border border-surface-border bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-bosch-blue";

  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={params.get("market") || ""}
        onChange={(e) => setParam("market", e.target.value)}
        className={selectCls}
      >
        <option value="">Tüm pazarlar</option>
        {markets.map((m) => (
          <option key={m.id} value={m.id}>
            {m.code} · {m.name}
          </option>
        ))}
      </select>

      <select
        value={params.get("status") || ""}
        onChange={(e) => setParam("status", e.target.value)}
        className={selectCls}
      >
        <option value="">Tüm statüler</option>
        <option value="draft">Taslak</option>
        <option value="translated">Çevrildi</option>
        <option value="approved">Onaylandı</option>
      </select>
    </div>
  );
}
