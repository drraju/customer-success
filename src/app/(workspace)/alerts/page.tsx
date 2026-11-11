import Link from "next/link";
import { redirect } from "next/navigation";
import { healthTone, PageIntro, Pill } from "@/components/ui";
import { dismissAlert } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { listOpenAlerts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const team = params.scope === "team";
  const alerts = listOpenAlerts(team ? null : user.id);
  return (
    <>
      <PageIntro
        title="Alerts"
        lede="These open on their own when a renewal, success plan, meeting, or task needs attention. Dismiss one you have handled. It opens again if that problem clears and returns, or if it gets worse."
        action={
          <div className="view-switch">
            <Link className={team ? undefined : "active"} href="/alerts">
              Mine
            </Link>
            <Link className={team ? "active" : undefined} href="/alerts?scope=team">
              Team
            </Link>
          </div>
        }
      />
      <section className="card">
        {alerts.length === 0 ? <p className="empty">No open alerts.</p> : null}
        {alerts.map((alert) => (
          <div className="alert-row" key={alert.id}>
            <Link href={`/customers/${alert.customerId}`}>
              <strong>{alert.customerName}</strong>
            </Link>
            <Pill tone={healthTone(alert.health)}>{alert.health}</Pill>
            <span>
              {alert.factor}. {alert.detail}
            </span>
            <form action={dismissAlert}>
              <input type="hidden" name="id" value={alert.id} />
              <button className="btn quiet" type="submit">
                Dismiss
              </button>
            </form>
          </div>
        ))}
      </section>
    </>
  );
}
