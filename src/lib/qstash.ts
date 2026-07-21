import { Client } from "@upstash/qstash";
import { requireEnv } from "@/lib/env";

/**
 * LAZY QStash client factory. The client is constructed on CALL, reading QSTASH_TOKEN then —
 * never at module load. Importing this file is therefore side-effect-free, so build/CI without
 * QStash creds stay green; a genuinely missing token fails loudly and early via MissingEnvError.
 */
export function getQStashClient(): Client {
  return new Client({ token: requireEnv("QSTASH_TOKEN") });
}
