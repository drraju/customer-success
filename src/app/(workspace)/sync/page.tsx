import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/auto-form";
import { Field, PageIntro } from "@/components/ui";
import { assignEvent, dismissEvent, runCalendarSync, runMailSync, saveCalendarFeed, saveMailbox } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getCalendarFeed, getMailbox, listCustomers, listUnmatchedEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SyncPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const feed = getCalendarFeed(user.id);
  const mailbox = getMailbox(user.id);
  const unmatched = listUnmatchedEvents(user.id);
  const customers = listCustomers({});

  return (
    <>
      <PageIntro
        title="Sync"
        lede="Pull meetings from a calendar feed and mail that mentions an account. Events match the contact email on the customer."
      />
      {params.saved === "calendar" ? <p className="notice">Calendar address saved.</p> : null}
      {params.saved === "mail" ? <p className="notice">Mailbox saved.</p> : null}
      {params.error === "calendar" ? <p className="error">Use an http or https calendar address.</p> : null}
      {params.error === "mail" ? <p className="error">Host, username, port, and a password are required.</p> : null}
      <div className="split">
        <section className="card">
          <h2>Calendar</h2>
          <p className="muted">Paste the secret iCal address from Google Calendar or Outlook.</p>
          <form action={saveCalendarFeed} className="form-grid">
            <Field label="Calendar address" wide>
              <input name="url" type="url" required defaultValue={feed?.url ?? ""} placeholder="https://calendar.google.com/calendar/ical/..." />
            </Field>
            <div className="form-actions wide">
              <button className="btn primary" type="submit">
                Save calendar
              </button>
            </div>
          </form>
          <form action={runCalendarSync} className="form-actions">
            <button className="btn" type="submit" disabled={!feed}>
              Sync calendar
            </button>
          </form>
          {feed?.lastStatus ? <p className={feed.lastStatus.startsWith("Could") || feed.lastStatus.includes("did not") || feed.lastStatus.includes("returned") ? "error" : "muted"}>{feed.lastStatus}</p> : null}
        </section>
        <section className="card">
          <h2>Mail</h2>
          <p className="muted">IMAP, usually port 993 with an app password. Messages from the last 21 days are matched to account emails.</p>
          <form action={saveMailbox} className="form-grid">
            <Field label="Host">
              <input name="host" required defaultValue={mailbox?.host ?? ""} placeholder="imap.gmail.com" />
            </Field>
            <Field label="Port">
              <input name="port" type="number" min={1} max={65535} required defaultValue={mailbox?.port ?? 993} />
            </Field>
            <Field label="Username" wide>
              <input name="username" required defaultValue={mailbox?.username ?? ""} autoComplete="username" />
            </Field>
            <Field label="Password" wide>
              <input name="password" type="password" autoComplete="current-password" placeholder={mailbox ? "Leave blank to keep the saved password" : ""} required={!mailbox} />
            </Field>
            <label className="field wide check">
              <input name="secure" type="checkbox" value="1" defaultChecked={mailbox?.secure ?? true} />
              <span>Use TLS</span>
            </label>
            <div className="form-actions wide">
              <button className="btn primary" type="submit">
                Save mailbox
              </button>
            </div>
          </form>
          <form action={runMailSync} className="form-actions">
            <button className="btn" type="submit" disabled={!mailbox}>
              Sync mail
            </button>
          </form>
          {mailbox?.lastStatus ? <p className={mailbox.lastStatus.startsWith("Could") || mailbox.lastStatus.startsWith("The mail") ? "error" : "muted"}>{mailbox.lastStatus}</p> : null}
        </section>
      </div>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Calendar events that need an account</h2>
        {unmatched.length === 0 ? <p className="empty">Nothing waiting. A synced event lands here when none of its guests match a contact email.</p> : null}
        {unmatched.map((event) => (
          <div className="sync-row" key={event.id}>
            <strong>{event.title}</strong>
            <span className="muted">
              {formatDate(event.date)}
              {event.attendees ? ` · ${event.attendees}` : ""}
            </span>
            <form action={assignEvent} className="assign-row">
              <input type="hidden" name="id" value={event.id} />
              <select name="customerId" required aria-label={`Account for ${event.title}`} defaultValue="">
                <option value="" disabled>
                  Choose an account
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <button className="btn" type="submit">
                Assign
              </button>
            </form>
            <ConfirmSubmit action={dismissEvent} fields={{ id: event.id }} label="Dismiss" message="Remove this event without adding a meeting?" className="btn quiet" />
          </div>
        ))}
      </section>
    </>
  );
}
