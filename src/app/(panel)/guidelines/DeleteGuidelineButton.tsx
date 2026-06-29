"use client";

import { useTransition } from "react";
import { deleteGuideline } from "./actions";
import { useT } from "@/components/LangProvider";

export default function DeleteGuidelineButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const t = useT();

  return (
    <button
      onClick={() => {
        if (!confirm(t("gl.confirmDelete"))) return;
        start(() => deleteGuideline(id));
      }}
      disabled={pending}
      className="rounded-bosch border border-bosch-red px-3 py-1.5 text-sm font-medium text-bosch-red hover:bg-bosch-red/10 transition-colors disabled:opacity-60"
    >
      {pending ? "…" : t("gl.delete")}
    </button>
  );
}
