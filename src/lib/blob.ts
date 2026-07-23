import { put, del, get } from "@vercel/blob";
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
 *  - `access: "private"` — the most restrictive mode the SDK offers (not publicly readable).
 *  - `addRandomSuffix` — even the pathname isn't guessable.
 *  - The returned URL is kept ONLY in our DB (never the queue/logs) and the worker (3D) deletes
 *    the blob after processing, minimizing how long the PDF is reachable at all.
 */
export async function putStatementPdf(
  bytes: Uint8Array,
  fileName: string,
): Promise<{ url: string; pathname: string }> {
  // Vercel Blob's put() accepts Buffer/Blob/stream, not a bare Uint8Array — wrap it (Node runtime).
  const { url, pathname } = await put(`statements/${fileName}`, Buffer.from(bytes), {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/pdf",
    token: getBlobToken(),
  });
  return { url, pathname };
}

/**
 * Download a private statement PDF's bytes (the worker calls this). Private blobs aren't
 * readable by URL alone, so we fetch through the SDK with the token and drain the stream.
 */
export async function fetchStatementPdf(url: string): Promise<Uint8Array> {
  const res = await get(url, { access: "private", token: getBlobToken() });
  if (!res) throw new Error("blob_not_found");
  const buffer = await new Response(res.stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url, { token: getBlobToken() });
}
