"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pollUntilTerminal, type StatusSnapshot } from "@/lib/pollStatus";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing" }
  | { kind: "done"; transactionCount: number }
  | { kind: "failed"; reason: string | null }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

export function UploadForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "uploading" || phase.kind === "processing";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setPhase({ kind: "error", message: "Please choose a PDF file." });
      return;
    }

    setPhase({ kind: "uploading" });
    const body = new FormData();
    body.append("file", file);

    let statementId: string;
    try {
      const res = await fetch("/api/statements", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setPhase({ kind: "error", message: json?.error?.message ?? "Upload failed." });
        return;
      }
      statementId = json.statementId as string;
    } catch {
      setPhase({ kind: "error", message: "Network error — please try again." });
      return;
    }

    // Poll the status endpoint until the async worker reaches a terminal state.
    setPhase({ kind: "processing" });
    let snapshot: StatusSnapshot | null;
    try {
      snapshot = await pollUntilTerminal(async () => {
        const res = await fetch(`/api/statements/${statementId}/status`);
        return (await res.json()) as StatusSnapshot;
      });
    } catch {
      setPhase({ kind: "error", message: "Could not check processing status." });
      return;
    }

    if (!snapshot) setPhase({ kind: "timeout" });
    else if (snapshot.status === "PROCESSED") setPhase({ kind: "done", transactionCount: snapshot.transactionCount });
    else setPhase({ kind: "failed", reason: snapshot.error });

    router.refresh(); // revalidate the server-rendered statements list
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
        {phase.kind === "uploading" ? "Uploading…" : phase.kind === "processing" ? "Processing…" : "Upload"}
      </button>

      <p aria-live="polite" className="text-sm">
        {phase.kind === "processing" && (
          <span className="text-gray-600 dark:text-gray-400">Processing… this runs in the background.</span>
        )}
        {phase.kind === "done" && (
          <span className="text-green-700 dark:text-green-400">
            Processed — {phase.transactionCount} transaction(s).
          </span>
        )}
        {phase.kind === "failed" && (
          <span className="text-red-600">Failed{phase.reason ? ` — ${phase.reason}` : ""}.</span>
        )}
        {phase.kind === "timeout" && (
          <span className="text-gray-600 dark:text-gray-400">
            Still processing — refresh shortly to see the result.
          </span>
        )}
        {phase.kind === "error" && <span className="text-red-600">{phase.message}</span>}
      </p>
    </form>
  );
}
