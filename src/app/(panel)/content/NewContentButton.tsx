"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createContent } from "./actions";

export default function NewContentButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function create() {
    start(async () => {
      const fd = new FormData();
      fd.set("title", "Yeni içerik");
      fd.set("schema_type", "Article");
      const id = await createContent(fd);
      router.push(`/content/${id}`);
    });
  }

  return (
    <button
      onClick={create}
      disabled={pending}
      className="rounded-bosch bg-bosch-red px-4 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60"
    >
      {pending ? "Oluşturuluyor…" : "+ Yeni içerik"}
    </button>
  );
}
