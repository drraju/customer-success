import Link from "next/link";
import { listUsers } from "@/lib/auth";
import { HEALTH, STAGES, WINDOWS } from "@/lib/constants";
import { formatDate, formatDays, formatMoney } from "@/lib/dates";
import { listCustomers } from "@/lib/queries";
import { Field, healthTone, Options, PageIntro, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; health?: string; stage?: string; window?: string; owner?: string }>;
}) {
  const params = await searchParams;
  const people = listUsers();
  const customers = listCustomers({
    q: params.q,
    health: params.health,
    stage: params.stage,
    window: params.window,
    owner: params.owner,
  });

  return (
    <>
      <PageIntro
        title="Customers"
        lede="Health is calculated from the renewal, the success plan, the last meeting, and overdue tasks."
        action={
          <Link className="btn primary" href="/customers/new">
            New account
          </Link>
        }
      />
      <form className="filters" method="get">
        <Field label="Search">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Account name" />
        </Field>
        <Field label="Health">
          <select name="health" defaultValue={params.health ?? ""}>
            <Options values={HEALTH} blank="All health" />
          </select>
        </Field>
        <Field label="Stage">
          <select name="stage" defaultValue={params.stage ?? ""}>
            <Options values={STAGES} blank="All stages" />
          </select>
        </Field>
        <Field label="Renewal window">
          <select name="window" defaultValue={params.window ?? ""}>
            <Options values={WINDOWS} blank="Any date" />
          </select>
        </Field>
        <Field label="Owner">
          <select name="owner" defaultValue={params.owner ?? ""}>
            <option value="">Anyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn primary" type="submit">
          Apply
        </button>
        <Link className="btn" href="/customers">
          Clear
        </Link>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Health</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>ARR</th>
              <th>Renewal date</th>
              <th>Days to renewal</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7}>No accounts match these filters.</td>
              </tr>
            ) : null}
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link href={`/customers/${customer.id}`}>{customer.name}</Link>
                </td>
                <td>
                  <Pill tone={healthTone(customer.health)}>{customer.health}</Pill>
                </td>
                <td>{customer.stage}</td>
                <td>{customer.ownerName ?? "Unassigned"}</td>
                <td className="money">{formatMoney(customer.arr)}</td>
                <td>{formatDate(customer.renewalDate)}</td>
                <td className={customer.daysToRenewal !== null && customer.daysToRenewal < 0 ? "overdue" : undefined}>
                  {formatDays(customer.daysToRenewal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
