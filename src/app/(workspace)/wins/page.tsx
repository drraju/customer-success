import Link from "next/link";
import { Field, Options, PageIntro, Pill } from "@/components/ui";
import { createWin } from "@/lib/actions";
import { IMPACTS, WIN_TYPES } from "@/lib/constants";
import { formatDate, formatMoney, todayIso } from "@/lib/dates";
import { listCustomers, listWins } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function WinsPage() {
  const wins = listWins();
  const customers = listCustomers({});
  return (
    <>
      <PageIntro title="Wins" lede="Proof the accounts are moving." />
      <div className="split">
        <section className="card">
          <h2>Log a win</h2>
          {customers.length === 0 ? (
            <p className="empty">Add an account before logging a win.</p>
          ) : (
            <form action={createWin} className="form-grid">
              <Field label="Name" wide>
                <input name="name" required />
              </Field>
              <Field label="Account">
                <select name="customerId" required defaultValue={customers[0]?.id}>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select name="type" defaultValue="Adoption">
                  <Options values={WIN_TYPES} />
                </select>
              </Field>
              <Field label="Impact">
                <select name="impact" defaultValue="Medium">
                  <Options values={IMPACTS} />
                </select>
              </Field>
              <Field label="ARR impact">
                <input name="arrImpact" type="number" min="0" step="1" defaultValue="0" />
              </Field>
              <Field label="Date">
                <input name="winDate" type="date" required defaultValue={todayIso()} />
              </Field>
              <Field label="Summary" wide>
                <textarea name="summary" />
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Save win
                </button>
              </div>
            </form>
          )}
        </section>
        <section className="card">
          <h2>Recent wins</h2>
          {wins.length === 0 ? <p className="empty">No wins logged yet.</p> : null}
          {wins.map((win) => (
            <article className="item-block" key={win.id}>
              <Link href={`/customers/${win.customerId}?tab=wins`}>
                <strong>{win.name}</strong>
              </Link>
              <p className="muted">
                {win.customerName} · {formatDate(win.winDate)} · {formatMoney(win.arrImpact)}
              </p>
              <div className="pills">
                <Pill>{win.type}</Pill>
                <Pill tone={win.impact === "High" ? "good" : win.impact === "Low" ? "neutral" : "warn"}>{win.impact}</Pill>
              </div>
              {win.summary ? <p>{win.summary}</p> : null}
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
