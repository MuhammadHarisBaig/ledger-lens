import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";

type ShellUser = { name?: string | null; email?: string | null };

function initials(user: ShellUser): string {
  const source = user.name?.trim() || user.email?.trim() || "";
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Authenticated layout: a sticky top bar (wordmark + user chip with sign-out) over a centered
// max-width container. Server component — sign-out is an inline server action.
export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface-0/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/statements" className="text-sm font-semibold tracking-tight text-fg">
            Ledger<span className="text-accent">Lens</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-fg"
              >
                {initials(user)}
              </span>
              <span className="hidden sm:inline">{user.name ?? user.email}</span>
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
