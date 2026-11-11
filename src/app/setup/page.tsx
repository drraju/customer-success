import { redirect } from "next/navigation";
import { createOwner } from "@/lib/actions";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { Field } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  if (countUsers() > 0) redirect("/login");
  const params = await searchParams;
  return (
    <div className="auth-screen">
      <section className="card auth-card">
        <p className="auth-mark">Customer Success</p>
        <h1>Create the owner account</h1>
        <p className="lede">You are the first person in. This account can add teammates. Existing accounts are assigned to you.</p>
        {params.error ? <p className="error">Use a name, a valid email, and a password of at least 8 characters. The two passwords must match.</p> : null}
        <form action={createOwner} className="form-grid">
          <Field label="Name" wide>
            <input name="name" required autoComplete="name" />
          </Field>
          <Field label="Email" wide>
            <input name="email" type="email" required autoComplete="username" />
          </Field>
          <Field label="Password" wide>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" wide>
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <div className="form-actions wide">
            <button className="btn primary" type="submit">
              Create account
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
