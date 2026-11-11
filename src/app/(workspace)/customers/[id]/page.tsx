import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoForm, ConfirmSubmit } from "@/components/auto-form";
import { Empty, Field, healthTone, Options, Pill } from "@/components/ui";
import {
  addStandardPlan,
  createContact,
  createMeeting,
  createRenewal,
  createTask,
  createWin,
  deleteContact,
  deleteCustomer,
  deleteMeeting,
  deleteTask,
  deleteWin,
  makePrimaryContact,
  updateCustomer,
  updateMilestone,
  updateRenewal,
  updateTaskAssignee,
  updateTaskStatus,
} from "@/lib/actions";
import { getCurrentUser, listUsers } from "@/lib/auth";
import {
  CONTACT_ROLES,
  FORECASTS,
  IMPACTS,
  MEETING_TYPES,
  MILESTONE_STATUSES,
  PRIORITIES,
  RENEWAL_STAGES,
  RISKS,
  SENTIMENTS,
  STAGES,
  TASK_STATUSES,
  WIN_TYPES,
  isClosedRenewal,
} from "@/lib/constants";
import { formatDate, formatDays, formatMoney } from "@/lib/dates";
import { getCustomer, getTimeline, listContacts, listMeetings, listMilestones, listRenewals, listTasks, listWins } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["contacts", "Contacts"],
  ["plan", "Success plan"],
  ["meetings", "Meetings"],
  ["wins", "Wins"],
  ["renewal", "Renewal"],
  ["tasks", "Tasks"],
] as const;

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const customer = getCustomer(id);
  if (!customer) notFound();
  const tab = TABS.some(([key]) => key === query.tab) ? query.tab : "overview";
  const contacts = listContacts(id);
  const milestones = listMilestones(id);
  const meetings = listMeetings().filter((meeting) => meeting.customerId === id);
  const wins = listWins().filter((win) => win.customerId === id);
  const renewals = listRenewals().filter((renewal) => renewal.customerId === id);
  const tasks = listTasks().filter((task) => task.customerId === id);
  const openRenewal = renewals.find((renewal) => !isClosedRenewal(renewal.stage)) ?? null;
  const timeline = getTimeline(id);
  const people = listUsers();
  const currentUser = await getCurrentUser();

  return (
    <>
      <p className="crumb">
        <Link href="/customers">Customers</Link> <span>/</span> {customer.name}
      </p>
      <header className="record-head">
        <div>
          <h1>{customer.name}</h1>
          <p className="lede">
            {customer.primaryContact || "No primary contact"}
            {customer.contactEmail ? ` · ${customer.contactEmail}` : ""}
          </p>
        </div>
        <div className="health-form">
          <span className="field">
            <span>Health</span>
            <Pill tone={healthTone(customer.health)}>{customer.health}</Pill>
          </span>
        </div>
      </header>
      <ul className="factors" aria-label="Why this health">
        {customer.healthFactors.map((factor) => (
          <li className="factor" key={factor.name}>
            <Pill tone={healthTone(factor.health)}>{factor.health}</Pill>
            <span>
              {factor.name}. {factor.detail}
            </span>
          </li>
        ))}
      </ul>
      <dl className="record-metrics">
        <div>
          <dt>Owner</dt>
          <dd>{customer.ownerName ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Stage</dt>
          <dd>{customer.stage}</dd>
        </div>
        <div>
          <dt>ARR</dt>
          <dd className="money">{formatMoney(customer.arr)}</dd>
        </div>
        <div>
          <dt>Renewal date</dt>
          <dd>{formatDate(customer.renewalDate)}</dd>
        </div>
        <div>
          <dt>Days left</dt>
          <dd className={customer.daysToRenewal !== null && customer.daysToRenewal < 0 ? "overdue" : undefined}>
            {formatDays(customer.daysToRenewal)}
          </dd>
        </div>
      </dl>
      <nav className="tabs" aria-label="Account sections">
        {TABS.map(([key, label]) => (
          <Link key={key} className={tab === key ? "tab active" : "tab"} href={`/customers/${id}?tab=${key}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "contacts" ? (
        <div className="split">
          <section className="card">
            <h2>Add a person</h2>
            <form action={createContact} className="form-grid">
              <input type="hidden" name="customerId" value={customer.id} />
              <Field label="Name" wide>
                <input name="name" required />
              </Field>
              <Field label="Email">
                <input name="email" type="email" />
              </Field>
              <Field label="Role">
                <select name="role" defaultValue="User">
                  <Options values={CONTACT_ROLES} />
                </select>
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Add person
                </button>
              </div>
            </form>
          </section>
          <section className="card">
            <h2>People</h2>
            <p className="muted">Calendar and mail match any of these addresses. The primary person is shown on the account.</p>
            {contacts.length === 0 ? <Empty>No people on this account yet.</Empty> : null}
            {contacts.map((contact) => (
              <article className="item-block" key={contact.id}>
                <strong>{contact.name}</strong> {contact.isPrimary ? <Pill tone="good">Primary</Pill> : null}
                <p className="muted">
                  {contact.role}
                  {contact.email ? ` · ${contact.email}` : ""}
                </p>
                <div className="inline-actions">
                  {contact.isPrimary ? null : (
                    <form action={makePrimaryContact}>
                      <input type="hidden" name="id" value={contact.id} />
                      <button className="btn quiet" type="submit">
                        Make primary
                      </button>
                    </form>
                  )}
                  <ConfirmSubmit action={deleteContact} fields={{ id: contact.id }} label="Remove" message={`Remove ${contact.name}?`} className="btn quiet" />
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="split">
          <section className="card">
            <h2>Details</h2>
            <form action={updateCustomer} className="form-grid" key={`${customer.stage}-${customer.arr}-${customer.renewalDate}-${customer.ownerId}`}>
              <input type="hidden" name="id" value={customer.id} />
              <Field label="Stage">
                <select name="stage" defaultValue={customer.stage}>
                  <Options values={STAGES} />
                </select>
              </Field>
              <Field label="ARR">
                <input name="arr" type="number" min="0" step="1" defaultValue={customer.arr} />
              </Field>
              <Field label="Renewal date">
                <input name="renewalDate" type="date" defaultValue={customer.renewalDate ?? ""} />
              </Field>
              <Field label="Primary contact">
                <input name="primaryContact" defaultValue={customer.primaryContact} />
              </Field>
              <Field label="Email">
                <input name="contactEmail" type="email" defaultValue={customer.contactEmail} />
              </Field>
              <Field label="Owner" wide>
                <select name="ownerId" defaultValue={customer.ownerId ?? ""}>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Save details
                </button>
              </div>
            </form>
            <div className="form-actions">
              <ConfirmSubmit
                action={deleteCustomer}
                fields={{ id: customer.id }}
                label="Delete account"
                message="Delete this account and its meetings, wins, renewals, tasks, and success plan?"
              />
            </div>
          </section>
          <section className="card">
            <h2>Timeline</h2>
            {timeline.length === 0 ? <Empty>Meetings, emails, wins, and completed tasks show up here.</Empty> : null}
            <ol className="timeline">
              {timeline.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <div className="kind">
                    {item.kind} · {formatDate(item.date)}
                  </div>
                  <strong>{item.title}</strong>
                  {item.detail ? <p className="muted">{item.detail}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}

      {tab === "plan" ? (
        <section className="card">
          <h2>Success plan</h2>
          {milestones.length === 0 ? (
            <>
              <Empty>No phases yet.</Empty>
              <form action={addStandardPlan}>
                <input type="hidden" name="customerId" value={customer.id} />
                <button className="btn primary" type="submit">
                  Add standard phases
                </button>
              </form>
            </>
          ) : (
            milestones.map((milestone) => (
              <AutoForm action={updateMilestone} className="phase-row" key={milestone.id}>
                <input type="hidden" name="id" value={milestone.id} />
                <strong>{milestone.name}</strong>
                <select name="status" defaultValue={milestone.status} aria-label={`${milestone.name} status`} key={`${milestone.id}-${milestone.status}`}>
                  <Options values={MILESTONE_STATUSES} />
                </select>
                <input name="targetDate" type="date" defaultValue={milestone.targetDate ?? ""} aria-label={`${milestone.name} target`} key={`${milestone.id}-${milestone.targetDate ?? ""}`} />
              </AutoForm>
            ))
          )}
        </section>
      ) : null}

      {tab === "meetings" ? (
        <div className="split">
          <section className="card">
            <h2>Log a meeting</h2>
            <form action={createMeeting} className="form-grid">
              <input type="hidden" name="customerId" value={customer.id} />
              <Field label="Title" wide>
                <input name="title" required placeholder="QBR, check-in, renewal call" />
              </Field>
              <Field label="Date">
                <input name="meetingDate" type="date" required />
              </Field>
              <Field label="Type">
                <select name="type" defaultValue="Check-in">
                  <Options values={MEETING_TYPES} />
                </select>
              </Field>
              <Field label="Sentiment">
                <select name="sentiment" defaultValue="Neutral">
                  <Options values={SENTIMENTS} />
                </select>
              </Field>
              <Field label="Outcome" wide>
                <textarea name="outcome" />
              </Field>
              <Field label="Next steps" wide>
                <textarea name="nextSteps" />
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Save meeting
                </button>
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Meetings</h2>
            {meetings.length === 0 ? <Empty>No meetings yet.</Empty> : null}
            {[...meetings].reverse().map((meeting) => (
              <article className="item-block" key={meeting.id}>
                <strong>{meeting.title}</strong>
                <p className="muted">
                  {formatDate(meeting.meetingDate)} · {meeting.type} · {meeting.sentiment}
                  {meeting.source === "calendar" ? " · Calendar" : ""}
                </p>
                {meeting.outcome ? <p>{meeting.outcome}</p> : null}
                {meeting.nextSteps ? <p className="muted">Next: {meeting.nextSteps}</p> : null}
                <ConfirmSubmit action={deleteMeeting} fields={{ id: meeting.id }} label="Delete" message="Delete this meeting?" className="btn quiet" />
              </article>
            ))}
          </section>
        </div>
      ) : null}

      {tab === "wins" ? (
        <div className="split">
          <section className="card">
            <h2>Log a win</h2>
            <form action={createWin} className="form-grid">
              <input type="hidden" name="customerId" value={customer.id} />
              <Field label="Name" wide>
                <input name="name" required />
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
                <input name="winDate" type="date" required />
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
          </section>
          <section className="card">
            <h2>Wins</h2>
            {wins.length === 0 ? <Empty>No wins yet.</Empty> : null}
            {wins.map((win) => (
              <article className="item-block" key={win.id}>
                <strong>{win.name}</strong>
                <p className="muted">
                  {formatDate(win.winDate)} · {win.type} · {win.impact} · {formatMoney(win.arrImpact)}
                </p>
                {win.summary ? <p>{win.summary}</p> : null}
                <ConfirmSubmit action={deleteWin} fields={{ id: win.id }} label="Delete" message="Delete this win?" className="btn quiet" />
              </article>
            ))}
          </section>
        </div>
      ) : null}

      {tab === "renewal" ? (
        <section className="card">
          <h2>Renewal</h2>
          <p className="muted">Closed won starts the next term one year later. Closed lost marks the account churned.</p>
          {openRenewal ? (
            <form action={updateRenewal} className="form-grid" key={openRenewal.id}>
              <input type="hidden" name="id" value={openRenewal.id} />
              <Field label="Amount">
                <input name="amount" type="number" min="0" step="1" defaultValue={openRenewal.amount} />
              </Field>
              <Field label="Renewal date">
                <input name="renewalDate" type="date" defaultValue={openRenewal.renewalDate ?? ""} />
              </Field>
              <Field label="Stage">
                <select name="stage" defaultValue={openRenewal.stage}>
                  <Options values={RENEWAL_STAGES} />
                </select>
              </Field>
              <Field label="Risk">
                <select name="risk" defaultValue={openRenewal.risk}>
                  <Options values={RISKS} />
                </select>
              </Field>
              <Field label="Forecast">
                <select name="forecast" defaultValue={openRenewal.forecast}>
                  <Options values={FORECASTS} />
                </select>
              </Field>
              <Field label="Notes" wide>
                <textarea name="notes" defaultValue={openRenewal.notes} />
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Save renewal
                </button>
                <Link className="btn" href={`/renewals/${openRenewal.id}`}>
                  Open on renewals board
                </Link>
              </div>
            </form>
          ) : (
            <form action={createRenewal} className="form-grid">
              <p className="muted wide">No open renewal. Start the next one.</p>
              <input type="hidden" name="customerId" value={customer.id} />
              <Field label="Amount">
                <input name="amount" type="number" min="0" step="1" defaultValue={customer.arr} />
              </Field>
              <Field label="Renewal date">
                <input name="renewalDate" type="date" defaultValue={customer.renewalDate ?? ""} />
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Start renewal
                </button>
              </div>
            </form>
          )}
          {renewals.some((renewal) => isClosedRenewal(renewal.stage)) ? (
            <div>
              <h2>Closed</h2>
              {renewals
                .filter((renewal) => isClosedRenewal(renewal.stage))
                .map((renewal) => (
                  <p key={renewal.id}>
                    <Pill>{renewal.stage}</Pill> {renewal.name} · {formatMoney(renewal.amount)} · {formatDate(renewal.renewalDate)}
                  </p>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "tasks" ? (
        <div className="split">
          <section className="card">
            <h2>Add a task</h2>
            <form action={createTask} className="form-grid">
              <input type="hidden" name="customerId" value={customer.id} />
              <Field label="Task" wide>
                <input name="title" required />
              </Field>
              <Field label="Due">
                <input name="dueDate" type="date" />
              </Field>
              <Field label="Priority">
                <select name="priority" defaultValue="Medium">
                  <Options values={PRIORITIES} />
                </select>
              </Field>
              <Field label="Assignee">
                <select name="assigneeId" defaultValue={currentUser?.id ?? people[0]?.id}>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-actions wide">
                <button className="btn primary" type="submit">
                  Add task
                </button>
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Tasks</h2>
            {tasks.length === 0 ? <Empty>No tasks for this account.</Empty> : null}
            {tasks.map((task) => (
              <div className="item-row" key={task.id}>
                <strong>{task.title}</strong>
                <span className={task.daysUntilDue !== null && task.daysUntilDue < 0 && task.status !== "Done" ? "overdue" : "muted"}>
                  {formatDate(task.dueDate)} · {task.priority} · {task.assigneeName ?? "Unassigned"}
                </span>
                <AutoForm action={updateTaskStatus} className="compact-select">
                  <input type="hidden" name="id" value={task.id} />
                  <select name="status" defaultValue={task.status} aria-label={`${task.title} status`} key={`${task.id}-${task.status}`}>
                    <Options values={TASK_STATUSES} />
                  </select>
                </AutoForm>
                <ConfirmSubmit action={deleteTask} fields={{ id: task.id }} label="Delete" message="Delete this task?" className="btn quiet" />
              </div>
            ))}
          </section>
        </div>
      ) : null}
    </>
  );
}
