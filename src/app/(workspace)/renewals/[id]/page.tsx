import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/auto-form";
import { Field, Options, PageIntro } from "@/components/ui";
import { deleteRenewal, updateRenewal } from "@/lib/actions";
import { FORECASTS, RENEWAL_STAGES, RISKS } from "@/lib/constants";
import { getRenewal } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RenewalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const renewal = getRenewal(id);
  if (!renewal) notFound();

  return (
    <>
      <p className="crumb">
        <Link href="/renewals">Renewals</Link> <span>/</span> {renewal.customerName}
      </p>
      <PageIntro title={renewal.name} lede="Update the forecast, risk, and stage, then jump back to the account." />
      <section className="card">
        <form action={updateRenewal} className="form-grid">
          <input type="hidden" name="id" value={renewal.id} />
          <Field label="Amount">
            <input name="amount" type="number" min="0" step="1" defaultValue={renewal.amount} />
          </Field>
          <Field label="Renewal date">
            <input name="renewalDate" type="date" defaultValue={renewal.renewalDate ?? ""} />
          </Field>
          <Field label="Stage">
            <select name="stage" defaultValue={renewal.stage}>
              <Options values={RENEWAL_STAGES} />
            </select>
          </Field>
          <Field label="Risk">
            <select name="risk" defaultValue={renewal.risk}>
              <Options values={RISKS} />
            </select>
          </Field>
          <Field label="Forecast">
            <select name="forecast" defaultValue={renewal.forecast}>
              <Options values={FORECASTS} />
            </select>
          </Field>
          <Field label="Notes" wide>
            <textarea name="notes" defaultValue={renewal.notes} />
          </Field>
          <div className="form-actions wide">
            <button className="btn primary" type="submit">
              Save renewal
            </button>
            <Link className="btn" href={`/customers/${renewal.customerId}?tab=plan`}>
              Open success plan
            </Link>
            <Link className="btn" href={`/customers/${renewal.customerId}`}>
              Open account
            </Link>
          </div>
        </form>
        <ConfirmSubmit action={deleteRenewal} fields={{ id: renewal.id }} label="Delete renewal" message="Delete this renewal?" />
      </section>
    </>
  );
}
