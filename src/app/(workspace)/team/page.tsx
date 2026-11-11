import { ConfirmSubmit } from "@/components/auto-form";
import { Field, PageIntro, Pill } from "@/components/ui";
import { addMember, changePassword, removeMember } from "@/lib/actions";
import { getCurrentUser, listUsers } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string; password?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const people = listUsers();
  const owners = people.filter((person) => person.role === "owner").length;

  return (
    <>
      <PageIntro title="Team" lede="People who can sign in. Accounts and tasks can be assigned to anyone here." />
      {params.added ? <p className="notice">Teammate added. Share the password with them so they can sign in.</p> : null}
      {params.password ? <p className="notice">Password updated.</p> : null}
      {params.error === "email" ? <p className="error">That email is already on the team.</p> : null}
      {params.error === "invalid" ? <p className="error">Name, a valid email, and a password of at least 8 characters are required.</p> : null}
      {params.error === "password" ? <p className="error">Current password was wrong, or the new passwords did not match.</p> : null}
      <div className="split">
        <section className="card">
          <h2>People</h2>
          {people.map((person) => (
            <div className="item-row" key={person.id}>
              <strong>{person.name}</strong>
              <span className="muted">{person.email}</span>
              <Pill tone={person.role === "owner" ? "good" : "neutral"}>{person.role === "owner" ? "Owner" : "Teammate"}</Pill>
              {user.role === "owner" && person.id !== user.id && !(person.role === "owner" && owners <= 1) ? (
                <ConfirmSubmit
                  action={removeMember}
                  fields={{ id: person.id }}
                  label="Remove"
                  message={`Remove ${person.name}? Their accounts and tasks move to you.`}
                  className="btn quiet"
                />
              ) : (
                <span />
              )}
            </div>
          ))}
        </section>
        <div>
          {user.role === "owner" ? (
            <section className="card" style={{ marginBottom: 14 }}>
              <h2>Add a teammate</h2>
              <form action={addMember} className="form-grid">
                <Field label="Name" wide>
                  <input name="name" required />
                </Field>
                <Field label="Email" wide>
                  <input name="email" type="email" required />
                </Field>
                <Field label="Password" wide>
                  <input name="password" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
                <div className="form-actions wide">
                  <button className="btn primary" type="submit">
                    Add teammate
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <section className="card">
            <h2>Your password</h2>
            <form action={changePassword} className="form-grid">
              <Field label="Current password" wide>
                <input name="password" type="password" required autoComplete="current-password" />
              </Field>
              <Field label="New password" wide>
                <input name="next" type="password" required minLength={8} autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" wide>
                <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Update password
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
