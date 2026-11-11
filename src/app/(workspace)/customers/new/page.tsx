import Link from "next/link";
import { redirect } from "next/navigation";
import { createCustomer } from "@/lib/actions";
import { getCurrentUser, listUsers } from "@/lib/auth";
import { STAGES } from "@/lib/constants";
import { Field, Options, PageIntro } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const people = listUsers();
  return (
    <>
      <PageIntro title="New account" lede="A success plan and an open renewal are created with the account." />
      <section className="card">
        {params.error ? <p className="error">Name and stage are required.</p> : null}
        <form action={createCustomer} className="form-grid">
          <Field label="Name" wide>
            <input name="name" required placeholder="Account name" />
          </Field>
          <Field label="Stage">
            <select name="stage" defaultValue="Onboarding">
              <Options values={STAGES} />
            </select>
          </Field>
          <Field label="ARR">
            <input name="arr" type="number" min="0" step="1" defaultValue="0" />
          </Field>
          <Field label="Renewal date">
            <input name="renewalDate" type="date" />
          </Field>
          <Field label="Primary contact" wide>
            <input name="primaryContact" placeholder="Name" />
          </Field>
          <Field label="Owner" wide>
            <select name="ownerId" defaultValue={user.id}>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions wide">
            <button className="btn primary" type="submit">
              Save account
            </button>
            <Link className="btn" href="/customers">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
