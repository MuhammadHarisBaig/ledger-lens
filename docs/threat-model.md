# LedgerLens — Threat Model

> Living document. Updated at each milestone as new components are added.
> Last updated: Milestone 6 (deployed) — controls below are implemented unless noted.

## Assets (what's worth protecting)

- Uploaded statement PDFs (raw financial data)
- Extracted transactions (amounts, merchants, dates — sensitive PII)
- User identity + session (Google OAuth, session tokens)
- Secrets: DB URL, AUTH_SECRET, Gemini key, QStash tokens, Redis credentials
- LLM/compute budget (abuse = real money)

## Actors (who might cause harm)

- Another authenticated user trying to read someone else's statements
- An unauthenticated attacker on the internet
- An attacker who obtains a leaked secret
- Automated abuse (bots hammering upload / Q&A to burn LLM budget)

## Entry points (where they get in)

- Google sign-in / session
- Upload endpoint (file input) — the primary user-facing abuse surface
- The QStash worker endpoint (machine-to-machine — must verify signature)

_(Categorization is an internal worker step, not a user-facing endpoint; there is no public Q&A
surface in the shipped app.)_

## Controls (what I'm doing about it) — mapped to milestone

| Threat                          | Control                                                                            | Status                                     |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| One user reading another's data | Every read filtered by userId (getOwnedStatement); not-owned ⇒ 404, never 403      | In place                                   |
| Leaked secrets in git           | .env\* gitignored, .env.example has names only, git status checked before push     | In place                                   |
| Secrets in client bundle        | Server-only usage; lazy env reads at call time; never exposed to client            | In place                                   |
| PII leaking into logs           | Never log transaction contents/amounts/file bytes/blob URLs — only ids/status/timing/metrics | In place                         |
| Open worker endpoint abused     | QStash signature verified against the raw body before ANY work; unsigned ⇒ 401     | In place                                   |
| Upload abuse burning budget     | Per-user Redis sliding-window rate limit, enforced before any expensive work; fail-open on outage | In place                    |
| Malicious/oversized file upload | Validate PDF magic bytes + size cap, reject early (Content-Type is advisory only)  | In place                                   |
| Duplicate/replayed job delivery | Redis SET NX idempotency marker + DB status guard (UPLOADED-only) — at-most-once processing | In place                          |
| Raw financial PDF over-exposed  | Blob stored with unguessable suffix, URL kept in DB only (never queued/logged), deleted after a terminal outcome | In place       |
| User can't remove their data    | ON DELETE CASCADE on all user-owned tables (schema-enforced); self-serve delete flow not yet built | Partial (cascade in place; UI future work) |

## OWASP Top-10 touchpoints (to revisit each milestone)

- A01 Broken Access Control → ownership invariant (the big one here)
- A02 Cryptographic Failures → secrets handling, data at rest
- A05 Security Misconfiguration → env parity, worker auth
- (expand as the app grows)

## Known limitations / accepted risks

These are deliberate scope boundaries for a portfolio project, documented rather than hidden:

- **Vercel Blob public capability-URLs.** Uploaded PDFs are stored as *public* blobs. The mitigation
  is a random, unguessable suffix in the URL (possession of the URL is the capability), the URL is
  kept only in our database (never placed in the QStash message or any log), and the blob is
  **deleted once processing reaches a terminal state** — so the exposure window is small. A hardened
  production system would instead issue **signed, short-lived URLs** with true access control.
  Accepted at portfolio scale.

- **Single documented statement format.** The parser targets one predictable line format. Malformed
  or other-bank inputs are treated as a normal outcome: extraction/parse failures mark the statement
  `FAILED` with a friendly, non-leaking message and clean up — **never a crash or a stack trace to
  the client**. Robust multi-format parsing (LLM-assisted) is future work, not a security gap.
