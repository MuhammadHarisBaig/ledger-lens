/**
 * Typed, explicit environment-variable access. Reading a required var through `requireEnv`
 * converts a vague, late runtime failure (a client blowing up deep inside an SDK) into a clear,
 * named error at the call site — and, crucially, only WHEN CALLED, so importing modules that use
 * it stays side-effect-free (build/CI without creds don't break).
 */
export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "MissingEnvError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new MissingEnvError(name);
  return value;
}
