import type { Health } from "@/lib/constants";
import { getDb } from "@/lib/db";
import type { HealthFactor } from "@/lib/health";

const RANK: Record<Health, number> = {
  Healthy: 0,
  "Needs attention": 1,
  "At risk": 2,
};

type AlertRow = {
  id: string;
  customer_id: string;
  factor: string;
  health: Health;
  detail: string;
  status: string;
};

export function syncAlerts(customers: Array<{ id: string; healthFactors: HealthFactor[] }>) {
  if (customers.length === 0) return;
  const db = getDb();
  const existing = db.prepare("SELECT id, customer_id, factor, health, detail, status FROM alerts").all() as AlertRow[];
  const byKey = new Map(existing.map((row) => [`${row.customer_id}\0${row.factor}`, row]));
  const seen = new Set<string>();
  const insert = db.prepare(
    "INSERT INTO alerts (id, customer_id, factor, health, detail, opened_at, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
  );
  const updateOpen = db.prepare("UPDATE alerts SET health = ?, detail = ? WHERE id = ?");
  const reopen = db.prepare(
    "UPDATE alerts SET health = ?, detail = ?, status = 'open', dismissed_at = NULL, opened_at = ? WHERE id = ?",
  );
  const now = new Date().toISOString();

  for (const customer of customers) {
    for (const factor of customer.healthFactors) {
      if (factor.health === "Healthy") continue;
      const key = `${customer.id}\0${factor.name}`;
      seen.add(key);
      const row = byKey.get(key);
      if (!row) {
        insert.run(crypto.randomUUID(), customer.id, factor.name, factor.health, factor.detail, now);
        continue;
      }
      if (row.status === "dismissed" && RANK[factor.health] > RANK[row.health]) {
        reopen.run(factor.health, factor.detail, now, row.id);
        continue;
      }
      if (row.health !== factor.health || row.detail !== factor.detail) {
        updateOpen.run(factor.health, factor.detail, row.id);
      }
    }
  }

  const customerIds = new Set(customers.map((customer) => customer.id));
  const remove = db.prepare("DELETE FROM alerts WHERE id = ?");
  for (const row of existing) {
    if (!customerIds.has(row.customer_id)) continue;
    if (!seen.has(`${row.customer_id}\0${row.factor}`)) remove.run(row.id);
  }
}
