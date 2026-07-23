export type StatusSnapshot = { status: string; transactionCount: number; error: string | null };

const isTerminal = (status: string) => status === "PROCESSED" || status === "FAILED";

/**
 * Poll a status fetcher until the statement reaches a terminal state (PROCESSED/FAILED) or the
 * attempt budget runs out. Pure and dependency-light: `sleep` is injectable so the loop is unit-
 * testable without real timers. Returns the terminal snapshot, or null on timeout (still working).
 */
export async function pollUntilTerminal(
  fetchStatus: () => Promise<StatusSnapshot>,
  opts: { delayMs?: number; maxAttempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<StatusSnapshot | null> {
  const {
    delayMs = 1500,
    maxAttempts = 40,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = opts;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const snapshot = await fetchStatus();
    if (isTerminal(snapshot.status)) return snapshot;
    await sleep(delayMs);
  }
  return null; // timed out — still processing
}
