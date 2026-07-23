export type StatusSnapshot = {
  status: string; // UPLOADED | PROCESSING | PROCESSED | FAILED
  jobState: string | null;
  transactionCount: number;
  message: string | null; // friendly failure message when FAILED, else null
};

export const POLL_INTERVAL_MS = 2500; // named — no magic number
export const POLL_MAX_ATTEMPTS = 48; // ~2 min ceiling, then surface "still processing"

// The pure "should we stop polling?" decision — unit-testable without timers/DOM.
export function isTerminalStatus(status: string): boolean {
  return status === "PROCESSED" || status === "FAILED";
}
