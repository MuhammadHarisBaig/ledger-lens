import { signIn } from "@/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Reveal } from "@/components/motion/Reveal";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Reveal className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.04] px-10 py-12 shadow-xl shadow-black/30 ring-1 ring-emerald-400/10 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-5xl font-semibold tracking-tight">
            Ledger<span className="text-accent">Lens</span>
          </h1>
          <p className="max-w-md text-lg text-fg-muted">
            Upload a statement PDF and turn opaque transactions into clear spending insight.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <SubmitButton variant="primary" pendingLabel="Signing in…">
            Sign in with Google
          </SubmitButton>
        </form>
      </Reveal>
    </main>
  );
}
