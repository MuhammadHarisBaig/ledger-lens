// All Redis-related tunables in one place (no magic numbers scattered across routes).

// Worker idempotency marker (per jobId). TTL is a CRASH SAFETY-NET, sized to exceed one attempt's
// worst-case processing — NOT the retry window (the marker is released when the attempt returns,
// so a long TTL would only risk wrongly skipping a legitimate retry).
export const JOB_LOCK_PREFIX = "ledgerlens:worker:lock:";
// Bumped 300 → 600: the worker now makes an LLM (Gemini) call in the processing path, widening a
// single attempt's worst-case duration; the crash safety-net TTL must comfortably exceed it.
export const JOB_LOCK_TTL_SECONDS = 600;

// Per-user upload rate limit.
export const UPLOAD_LIMIT_MAX = 10;
export const UPLOAD_LIMIT_WINDOW = "60 s" as const; // @upstash/ratelimit duration string
export const UPLOAD_LIMIT_PREFIX = "ledgerlens:ratelimit:upload:";
