"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createGuideline } from "./actions";

export default function NewGuidelineButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function create() {
    start(async () => {
      const fd = new FormData();
      fd.set("title", "Yeni guideline");
      const id = await createGuideline(fd);
      router.push(`/guidelines/${id}`);
    });
  }

  return (
    <button
      onClick={create}
      disabled={pending}
      className="rounded-bosch bg-bosch-red px-4 py-2 text-sm font-medium text-white hover:bg-bosch-red-hover transition-colors disabled:opacity-60"
    >
      {pending ? "Oluşturuluyor…" : "+ Yeni guideline"}
    </button>
  );
}
