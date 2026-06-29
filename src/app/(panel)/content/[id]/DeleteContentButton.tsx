"use client";

import { useTransition } from "react";
import { deleteContent } from "../actions";
import { useT } from "@/components/LangProvider";

export default function DeleteContentButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const t = useT();

  return (
    <button
      onClick={() => {
        if (!confirm(t("content.confirmDelete"))) return;
        start(() => deleteContent(id));
      }}
      disabled={pending}
      className="rounded-bosch border border-bosch-red px-3 py-1.5 text-sm font-medium text-bosch-red hover:bg-bosch-red/10 transition-colors disabled:opacity-60"
    >
      {pending ? "…" : t("content.delete")}
    </button>
  );
}
