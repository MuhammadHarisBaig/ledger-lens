"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isTerminalStatus,
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  type StatusSnapshot,
} from "@/lib/pollStatus";

type Phase = "idle" | "uploading" | "processing" | "done" | "failed" | "timeout" | "error";

export function UploadForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [statementId, setStatementId] = useState<string | null>(null);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null); // failure/error text
  const busy = phase === "uploading" || phase === "processing";

  // Poll the status endpoint while processing. A setInterval that isn't cleared would keep firing
  // after the component unmounts (user navigates away) — wasting requests/cost and calling
  // setState on an unmounted component. The effect cleanup clears it; we also stop on terminal.
  useEffect(() => {
    if (phase !== "processing" || !statementId) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/statements/${statementId}/status`);
        const snap = (await res.json()) as StatusSnapshot;
        if (isTerminalStatus(snap.status)) {
          clearInterval(timer);
          if (snap.status === "PROCESSED") {
            setTransactionCount(snap.transactionCount);
            setPhase("done");
          } else {
            setMessage(snap.message ?? "Processing failed.");
            setPhase("failed");
          }
          router.refresh(); // revalidate the server-rendered statements list
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          clearInterval(timer);
          setPhase("timeout");
        }
      } catch {
        /* transient network error — keep polling until a terminal state or the attempt ceiling */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phase, statementId, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setMessage("Please choose a PDF file.");
      setPhase("error");
      return;
    }

    setMessage(null);
    setTransactionCount(null);
    setStatementId(null);
    setPhase("uploading");

    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/statements", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message ?? "Upload failed.");
        setPhase("error");
        return;
      }
      setStatementId(json.statementId as string);
      setPhase("processing"); // triggers the polling effect
    } catch {
      setMessage("Network error — please try again.");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setStatementId(null);
    setTransactionCount(null);
    setMessage(null);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>Statement PDF</span>
        <input type="file" name="file" accept="application/pdf" className="text-sm" />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-full bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {phase === "uploading" ? "Uploading…" : phase === "processing" ? "Processing…" : "Upload"}
      </button>

      {/* status changes announced to assistive tech */}
      <div aria-live="polite" className="flex items-center gap-2 text-sm">
        {phase === "processing" && (
          <>
            <span
              role="status"
              aria-label="Processing"
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
            />
            <span className="text-gray-600 dark:text-gray-400">Processing… this runs in the background.</span>
          </>
        )}
        {phase === "done" && (
          <span className="text-green-700 dark:text-green-400">
            Processed — {transactionCount} transaction(s).{" "}
            {statementId && (
              <Link href={`/statements/${statementId}`} className="underline">
                View statement
              </Link>
            )}
          </span>
        )}
        {phase === "failed" && (
          <span className="flex items-center gap-3 text-red-600">
            {message}
            <button type="button" onClick={reset} className="underline">
              Try another file
            </button>
          </span>
        )}
        {phase === "timeout" && (
          <span className="text-gray-600 dark:text-gray-400">
            Still processing — refresh shortly to see the result.
          </span>
        )}
        {phase === "error" && <span className="text-red-600">{message}</span>}
      </div>
    </form>
  );
}
