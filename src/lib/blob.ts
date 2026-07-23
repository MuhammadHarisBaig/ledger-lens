import { put, del } from "@vercel/blob";
import { requireEnv } from "@/lib/env";

/**
 * LAZY Vercel Blob token access — read at CALL time, never at module load (same CI-safety
 * pattern as getQStashClient/getRedis: importing this file has no side effects, so build/CI
 * without a Blob token stay green; a missing token throws a clear MissingEnvError at call time).
 */
export function getBlobToken(): string {
  return requireEnv("BLOB_READ_WRITE_TOKEN");
}

/**
 * Store the raw statement PDF. Security posture for financial files:
 *  - `access: "public"` — Vercel Blob's baseline mode (private access is a gated feature not all
 *    stores/plans have). Security comes from the next two points, not an ACL.
 *  - `addRandomSuffix` — the URL is unguessable, so possession of the URL is the capability.
 *  - The URL is kept ONLY in our DB (never the queue/logs) and the worker deletes the blob after
 *    processing, minimizing how long the PDF is reachable at all.
 */
export async function putStatementPdf(
  bytes: Uint8Array,
  fileName: string,
): Promise<{ url: string; pathname: string }> {
  // Vercel Blob's put() accepts Buffer/Blob/stream, not a bare Uint8Array — wrap it (Node runtime).
  const { url, pathname } = await put(`statements/${fileName}`, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/pdf",
    token: getBlobToken(),
  });
  return { url, pathname };
}

/**
 * Download the statement PDF's bytes (the worker calls this). The blob is public-but-unguessable,
 * so a plain authenticated-by-URL fetch retrieves it.
 */
export async function fetchStatementPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blob_fetch_failed:${res.status}`);
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url, { token: getBlobToken() });
}
