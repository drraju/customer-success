import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate, formatDays, formatLongDate, formatMoney } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth";
import { getHome } from "@/lib/queries";
import { BarChart, healthTone, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const team = params.scope === "team";
  const home = getHome(team ? null : user.id);
  const ownerQuery = team ? "" : `&owner=${encodeURIComponent(user.id)}`;
  return (
    <>
      <header className="page-intro">
        <div>
          <h1>Today</h1>
          <p>
            {formatLongDate()} · {team ? "Everyone's book" : `${user.name}'s book`}. Health is calculated, and alerts open from it.
          </p>
        </div>
        <div className="view-switch">
          <Link className={team ? undefined : "active"} href="/">
            Mine
          </Link>
          <Link className={team ? "active" : undefined} href="/?scope=team">
            Team
          </Link>
        </div>
      </header>
      <section className="stats">
        <Link className="stat" href={`/customers?health=At+risk${ownerQuery}`}>
          <span>At risk</span>
          <strong>{home.atRiskCount}</strong>
          <small>{team ? "Accounts" : "Your accounts"}</small>
        </Link>
        <Link className="stat" href={team ? "/renewals?view=list" : `/renewals?view=list&owner=${encodeURIComponent(user.id)}`}>
          <span>Due in 90 days</span>
          <strong>{home.dueCount}</strong>
          <small>Open renewals, including overdue</small>
        </Link>
        <Link className="stat" href={team ? "/tasks?scope=team" : "/tasks"}>
          <span>Open tasks</span>
          <strong>{home.openTaskCount}</strong>
          <small>{team ? "Not done" : "Assigned to you"}</small>
        </Link>
        <a className="stat" href="#meetings">
          <span>Meetings this week</span>
          <strong>{home.meetingsThisWeek}</strong>
          <small>Today through six days</small>
        </a>
      </section>
      <section className="chart-grid">
        <BarChart title="Accounts by health" rows={home.healthChart} />
        <BarChart title="ARR by health" rows={home.arrChart} format="money" />
      </section>
      <section className="home-lists">
        <article className="card">
          <div className="card-head">
            <h2>Alerts</h2>
            <Link href={team ? "/alerts?scope=team" : "/alerts"}>All {home.openAlertCount}</Link>
          </div>
          {home.openAlerts.length === 0 ? <p className="empty">No open alerts.</p> : null}
          {home.openAlerts.map((alert) => (
            <Link className="row-link" key={alert.id} href={`/customers/${alert.customerId}`}>
              <strong>{alert.customerName}</strong>
              <span>
                {alert.factor}. {alert.detail}
              </span>
              <Pill tone={healthTone(alert.health)}>{alert.health}</Pill>
            </Link>
          ))}
        </article>
        <article className="card">
          <h2>Upcoming renewals</h2>
          {home.upcomingRenewals.length === 0 ? <p className="empty">No open renewals in the next 90 days.</p> : null}
          {home.upcomingRenewals.map((renewal) => (
            <Link className="row-link" key={renewal.id} href={`/customers/${renewal.customerId}?tab=renewal`}>
              <strong>{renewal.customerName}</strong>
              <span className={renewal.renewalWindow === "Overdue" ? "overdue" : undefined}>{formatDays(renewal.daysToRenewal)}</span>
              <span className="money">{formatMoney(renewal.amount)}</span>
            </Link>
          ))}
        </article>
        <article className="card">
          <h2>At-risk accounts</h2>
          {home.atRisk.length === 0 ? <p className="empty">No accounts are marked at risk.</p> : null}
          {home.atRisk.map((customer) => (
            <Link className="row-link" key={customer.id} href={`/customers/${customer.id}`}>
              <strong>{customer.name}</strong>
              <Pill tone={healthTone(customer.health)}>{customer.health}</Pill>
              <span>{formatDate(customer.renewalDate)}</span>
            </Link>
          ))}
        </article>
        <article className="card" id="meetings">
          <h2>Upcoming meetings</h2>
          {home.upcomingMeetings.length === 0 ? <p className="empty">No meetings scheduled.</p> : null}
          {home.upcomingMeetings.map((meeting) => (
            <Link className="row-link" key={meeting.id} href={`/customers/${meeting.customerId}?tab=meetings`}>
              <strong>{meeting.title}</strong>
              <span>{meeting.customerName}</span>
              <span>{formatDate(meeting.meetingDate)}</span>
            </Link>
          ))}
        </article>
        <article className="card">
          <h2>Open tasks</h2>
          {home.openTasks.length === 0 ? <p className="empty">No open tasks.</p> : null}
          {home.openTasks.map((task) => (
            <Link className="row-link" key={task.id} href="/tasks">
              <strong>{task.title}</strong>
              <span>{task.customerName}</span>
              <span className={task.daysUntilDue !== null && task.daysUntilDue < 0 ? "overdue" : undefined}>{formatDate(task.dueDate)}</span>
            </Link>
          ))}
        </article>
        <article className="card">
          <h2>Recent wins</h2>
          {home.recentWins.length === 0 ? <p className="empty">No wins logged yet.</p> : null}
          {home.recentWins.map((win) => (
            <Link className="row-link" key={win.id} href={`/customers/${win.customerId}?tab=wins`}>
              <strong>{win.name}</strong>
              <span>{win.customerName}</span>
              <Pill>{win.type}</Pill>
            </Link>
          ))}
        </article>
      </section>
    </>
  );
}
