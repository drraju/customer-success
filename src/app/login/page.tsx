import { redirect } from "next/navigation";
import { signIn } from "@/lib/actions";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { Field } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  if (countUsers() === 0) redirect("/setup");
  const params = await searchParams;
  return (
    <div className="auth-screen">
      <section className="card auth-card">
        <p className="auth-mark">Customer Success</p>
        <h1>Sign in</h1>
        <p className="lede">Use the email and password from your team.</p>
        {params.error ? <p className="error">That email and password did not match.</p> : null}
        <form action={signIn} className="form-grid">
          <Field label="Email" wide>
            <input name="email" type="email" required autoComplete="username" />
          </Field>
          <Field label="Password" wide>
            <input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <div className="form-actions wide">
            <button className="btn primary" type="submit">
              Sign in
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
