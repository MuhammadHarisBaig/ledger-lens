import { signIn } from "@/auth";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
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
        <Button type="submit" variant="primary">
          Sign in with Google
        </Button>
      </form>
    </main>
  );
}
