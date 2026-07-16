# LedgerLens — Threat Model

> Living document. Updated at each milestone as new components are added.
> Last updated: <date> — Milestone 1

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
- Upload endpoint (file input)
- The QStash worker endpoint (added in M3 — must verify signature)
- Q&A endpoint (added in M4 — LLM cost surface)

## Controls (what I'm doing about it) — mapped to milestone

| Threat                          | Control                                                                            | Status / Milestone                         |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| One user reading another's data | Every query filtered by userId via requireUser(); ownership re-checked server-side | In place (M1 helper), enforced per-feature |
| Leaked secrets in git           | .env\* gitignored, .env.example has names only, git status checked before push     | In place (M1)                              |
| Secrets in client bundle        | Server-only usage; never expose keys to client                                     | Ongoing                                    |
| PII leaking into logs           | Never log transaction contents/amounts/file bytes — only ids/status/timing         | Planned (enforce from M4)                  |
| Open worker endpoint abused     | QStash signature verification on worker route                                      | Planned (M3)                               |
| Upload/Q&A abuse burning budget | Redis-backed rate limiting                                                         | Planned (M4)                               |
| Malicious/oversized file upload | Validate MIME + magic bytes + size cap, reject early                               | Planned (M2)                               |
| User can't remove their data    | ON DELETE CASCADE on user-owned tables; delete flow                                | Planned (M6)                               |

## OWASP Top-10 touchpoints (to revisit each milestone)

- A01 Broken Access Control → ownership invariant (the big one here)
- A02 Cryptographic Failures → secrets handling, data at rest
- A05 Security Misconfiguration → env parity, worker auth
- (expand as the app grows)
