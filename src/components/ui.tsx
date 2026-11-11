import Link from "next/link";
import { formatMoney } from "@/lib/dates";

export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Options({ values, blank }: { values: readonly string[]; blank?: string }) {
  return (
    <>
      {blank !== undefined ? <option value="">{blank}</option> : null}
      {values.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function healthTone(health: string) {
  if (health === "Healthy") return "good";
  if (health === "At risk") return "bad";
  if (health === "Needs attention") return "warn";
  return "neutral";
}

export function riskTone(risk: string) {
  if (risk === "Low") return "good";
  if (risk === "High") return "bad";
  if (risk === "Medium") return "warn";
  return "neutral";
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function PageIntro({ title, lede, action }: { title: string; lede: string; action?: React.ReactNode }) {
  return (
    <header className="page-intro">
      <div>
        <h1>{title}</h1>
        <p>{lede}</p>
      </div>
      {action}
    </header>
  );
}

export function BarChart({
  title,
  rows,
  format = "number",
}: {
  title: string;
  rows: Array<{ label: string; value: number; tone: string }>;
  format?: "number" | "money";
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="bars">
        {rows.map((row) => (
          <div className="bar-row" key={row.label}>
            <span>{row.label}</span>
            <div className="bar-track">
              <div className={`bar-fill tone-${row.tone}`} style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 4 : 0)}%` }} />
            </div>
            <strong>{format === "money" ? formatMoney(row.value) : row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
