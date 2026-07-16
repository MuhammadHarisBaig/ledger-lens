import { signIn } from "@/auth";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">LedgerLens</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        Upload a statement PDF and turn opaque transactions into clear spending
        insight.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-black px-5 py-2.5 text-white dark:bg-white dark:text-black"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
