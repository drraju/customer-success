import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { Options, PageIntro, Pill, riskTone } from "@/components/ui";
import { updateRenewalStage } from "@/lib/actions";
import { RENEWAL_STAGES, isClosedRenewal } from "@/lib/constants";
import { formatDate, formatDays, formatMoney } from "@/lib/dates";
import { listRenewals } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RenewalsPage({ searchParams }: { searchParams: Promise<{ view?: string; owner?: string }> }) {
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";
  const owner = params.owner ?? "";
  const renewals = listRenewals().filter((renewal) => !owner || renewal.customerOwnerId === owner);
  const upcoming = renewals.filter(
    (renewal) => !isClosedRenewal(renewal.stage) && ["Overdue", "Next 30 days", "Next 90 days"].includes(renewal.renewalWindow),
  );

  return (
    <>
      <PageIntro
        title="Renewals"
        lede="Move a deal by changing its stage. Closed won starts the next term one year later. Closed lost marks the account churned."
      />
      <div className="view-switch">
        <Link className={view === "board" ? "active" : undefined} href={owner ? `/renewals?owner=${encodeURIComponent(owner)}` : "/renewals"}>
          Board
        </Link>
        <Link className={view === "list" ? "active" : undefined} href={owner ? `/renewals?view=list&owner=${encodeURIComponent(owner)}` : "/renewals?view=list"}>
          Upcoming list
        </Link>
      </div>
      {owner ? (
        <p className="lede" style={{ marginTop: -6 }}>
          Showing one owner’s renewals. <Link href={view === "list" ? "/renewals?view=list" : "/renewals"}>Show the whole team</Link>
        </p>
      ) : null}
      {view === "board" ? (
        <div className="board">
          {RENEWAL_STAGES.map((stage) => {
            const cards = renewals.filter((renewal) => renewal.stage === stage);
            return (
              <section className="column" key={stage}>
                <h2>
                  {stage} <span>({cards.length})</span>
                </h2>
                {cards.map((renewal) => (
                  <article className="deal" key={renewal.id}>
                    <Link href={`/customers/${renewal.customerId}`}>
                      <strong>{renewal.customerName}</strong>
                    </Link>
                    <div className="money">{formatMoney(renewal.amount)}</div>
                    <p className={renewal.renewalWindow === "Overdue" ? "meta overdue" : "meta"}>
                      {formatDate(renewal.renewalDate)} · {formatDays(renewal.daysToRenewal)}
                      {renewal.customerOwnerName ? ` · ${renewal.customerOwnerName}` : ""}
                    </p>
                    <div className="pills">
                      <Pill tone={riskTone(renewal.risk)}>{renewal.risk} risk</Pill>
                      <Pill>{renewal.forecast}</Pill>
                    </div>
                    <AutoForm action={updateRenewalStage} className="compact-select">
                      <input type="hidden" name="id" value={renewal.id} />
                      <select name="stage" defaultValue={renewal.stage} aria-label={`${renewal.customerName} stage`} key={`${renewal.id}-${renewal.stage}`}>
                        <Options values={RENEWAL_STAGES} />
                      </select>
                    </AutoForm>
                    <p>
                      <Link className="text-link" href={`/renewals/${renewal.id}`}>
                        Edit forecast
                      </Link>
                    </p>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Date</th>
                <th>Days</th>
                <th>Amount</th>
                <th>Stage</th>
                <th>Risk</th>
                <th>Forecast</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.length === 0 ? (
                <tr>
                  <td colSpan={7}>No open renewals are overdue or due within 90 days.</td>
                </tr>
              ) : null}
              {upcoming.map((renewal) => (
                <tr key={renewal.id}>
                  <td>
                    <Link href={`/customers/${renewal.customerId}?tab=renewal`}>{renewal.customerName}</Link>
                  </td>
                  <td>{formatDate(renewal.renewalDate)}</td>
                  <td className={renewal.daysToRenewal !== null && renewal.daysToRenewal < 0 ? "overdue" : undefined}>{formatDays(renewal.daysToRenewal)}</td>
                  <td className="money">{formatMoney(renewal.amount)}</td>
                  <td>{renewal.stage}</td>
                  <td>
                    <Pill tone={riskTone(renewal.risk)}>{renewal.risk}</Pill>
                  </td>
                  <td>
                    <Link href={`/renewals/${renewal.id}`}>{renewal.forecast}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
