import { Client, Receiver } from "@upstash/qstash";
import { requireEnv } from "@/lib/env";

/**
 * LAZY QStash client factory. The client is constructed on CALL, reading QSTASH_TOKEN then —
 * never at module load. Importing this file is therefore side-effect-free, so build/CI without
 * QStash creds stay green; a genuinely missing token fails loudly and early via MissingEnvError.
 * (Base URL comes from the QSTASH_URL env var when set — used to point at the local dev server.)
 */
export function getQStashClient(): Client {
  return new Client({ token: requireEnv("QSTASH_TOKEN") });
}

/**
 * LAZY QStash Receiver for verifying inbound worker-request signatures (same CI-safety pattern).
 * Reads both signing keys at call time; the worker verifies the raw body against them before
 * doing ANY work, so an unsigned/forged request can't drive the pipeline.
 */
export function getQStashReceiver(): Receiver {
  return new Receiver({
    currentSigningKey: requireEnv("QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: requireEnv("QSTASH_NEXT_SIGNING_KEY"),
  });
}
