export function todayIso() {
  return isoDaysFromToday(0);
}

export function isoDaysFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addYears(iso: string, years: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const shifted = new Date(year + years, month - 1, day);
  const resolved = shifted.getMonth() === month - 1 ? shifted : new Date(year + years, month, 0);
  const nextYear = resolved.getFullYear();
  const nextMonth = String(resolved.getMonth() + 1).padStart(2, "0");
  const nextDay = String(resolved.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function daysUntil(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export function renewalWindow(iso: string | null) {
  if (!iso) return "No date" as const;
  const days = daysUntil(iso);
  if (days < 0) return "Overdue" as const;
  if (days <= 30) return "Next 30 days" as const;
  if (days <= 90) return "Next 90 days" as const;
  return "Later" as const;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDays(days: number | null) {
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
