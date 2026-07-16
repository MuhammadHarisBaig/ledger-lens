import { requireUser } from "@/lib/auth";
import { signOut } from "@/auth";

export default async function DashboardPage() {
  const user = await requireUser(); // redirects to sign-in if not authenticated
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p>
        Signed in as {user.name} ({user.email})
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="rounded-full border px-5 py-2.5">
          Sign out
        </button>
      </form>
    </main>
  );
}
