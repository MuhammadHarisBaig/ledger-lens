"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadResult = {
  statementId: string;
  status: string;
  transactionCount: number;
  skippedLines: number;
};

export function UploadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError("Please choose a PDF file.");
      return;
    }

    setPending(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/statements", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Upload failed.");
        return;
      }
      setResult(json as UploadResult);
      router.refresh(); // revalidate the server-rendered statements list
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>Statement PDF</span>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          className="text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {result && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {result.status}: {result.transactionCount} transaction(s) parsed, {result.skippedLines}{" "}
          line(s) skipped.
        </p>
      )}
    </form>
  );
}
