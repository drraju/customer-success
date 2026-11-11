import { DatabaseSync } from "node:sqlite";
import { isoDaysFromToday } from "@/lib/dates";
import { PHASES } from "@/lib/constants";

export function seedIfEmpty(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
  if (row.n > 0) return;

  const northwindRenewal = isoDaysFromToday(20);
  const acmeRenewal = isoDaysFromToday(78);
  const globexRenewal = isoDaysFromToday(-28);
  const createdAt = new Date().toISOString();

  const insertCustomer = db.prepare(
    `INSERT INTO customers (id, name, health, stage, arr, renewal_date, primary_contact, contact_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRenewal = db.prepare(
    `INSERT INTO renewals (id, customer_id, name, amount, stage, risk, forecast, renewal_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMilestone = db.prepare(
    `INSERT INTO milestones (id, customer_id, name, phase, status, target_date, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMeeting = db.prepare(
    `INSERT INTO meetings (id, customer_id, title, meeting_date, type, sentiment, outcome, next_steps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertWin = db.prepare(
    `INSERT INTO wins (id, customer_id, name, type, impact, arr_impact, win_date, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertTask = db.prepare(
    `INSERT INTO tasks (id, customer_id, title, status, due_date, priority, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    insertCustomer.run(
      "cust_northwind",
      "Northwind",
      "At risk",
      "Renewal",
      84000,
      northwindRenewal,
      "Jordan Lee",
      "jordan@northwind.example",
      createdAt,
    );
    insertCustomer.run(
      "cust_acme",
      "Acme",
      "Healthy",
      "Value",
      120000,
      acmeRenewal,
      "Priya Shah",
      "priya@acme.example",
      createdAt,
    );
    insertCustomer.run(
      "cust_globex",
      "Globex",
      "Needs attention",
      "Renewal",
      36000,
      globexRenewal,
      "Sam Ortiz",
      "sam@globex.example",
      createdAt,
    );

    insertRenewal.run(
      "ren_northwind",
      "cust_northwind",
      "Northwind renewal",
      84000,
      "Negotiation",
      "High",
      "Best case",
      northwindRenewal,
      "Executive sponsor has gone quiet.",
    );
    insertRenewal.run(
      "ren_acme",
      "cust_acme",
      "Acme renewal",
      120000,
      "In progress",
      "Low",
      "Commit",
      acmeRenewal,
      "Expansion conversation is open.",
    );
    insertRenewal.run(
      "ren_globex",
      "cust_globex",
      "Globex renewal",
      36000,
      "In progress",
      "Medium",
      "Pipeline",
      globexRenewal,
      "Renewal date has passed.",
    );

    const northwindPlan: Array<[string, string, string | null]> = [
      ["Kickoff", "Done", isoDaysFromToday(-320)],
      ["Onboarding", "Done", isoDaysFromToday(-280)],
      ["Adoption", "In progress", isoDaysFromToday(40)],
      ["Value", "Not started", isoDaysFromToday(120)],
      ["Expansion", "Not started", isoDaysFromToday(180)],
      ["Renewal", "Not started", northwindRenewal],
    ];
    northwindPlan.forEach(([phase, status, target], index) => {
      insertMilestone.run(`ms_northwind_${index}`, "cust_northwind", phase, phase, status, target, index);
    });
    PHASES.forEach((phase, index) => {
      insertMilestone.run(`ms_acme_${index}`, "cust_acme", phase, phase, index < 3 ? "Done" : "Not started", null, index);
      insertMilestone.run(`ms_globex_${index}`, "cust_globex", phase, phase, "Not started", null, index);
    });

    insertMeeting.run(
      "mtg_northwind_past",
      "cust_northwind",
      "Renewal check-in",
      isoDaysFromToday(-7),
      "Renewal",
      "Concerned",
      "Usage dipped after the last release. The sponsor missed the call.",
      "Send the usage summary and book an executive check-in.",
    );
    insertMeeting.run(
      "mtg_northwind_next",
      "cust_northwind",
      "Executive follow-up",
      isoDaysFromToday(1),
      "Executive",
      "Neutral",
      "",
      "",
    );
    insertMeeting.run(
      "mtg_acme_qbr",
      "cust_acme",
      "Quarterly business review",
      isoDaysFromToday(4),
      "QBR",
      "Positive",
      "",
      "Prepare the expansion slide.",
    );

    insertWin.run(
      "win_acme",
      "cust_acme",
      "Second team went live",
      "Expansion",
      "High",
      25000,
      isoDaysFromToday(-21),
      "Acme agreed to a case study after the second team launched.",
    );

    insertTask.run(
      "task_usage",
      "cust_northwind",
      "Send Northwind usage summary",
      "Not started",
      isoDaysFromToday(2),
      "High",
      null,
    );
    insertTask.run(
      "task_exec",
      "cust_northwind",
      "Book Northwind executive check-in",
      "In progress",
      isoDaysFromToday(6),
      "High",
      null,
    );
    insertTask.run(
      "task_qbr",
      "cust_acme",
      "Prep Acme QBR deck",
      "Not started",
      isoDaysFromToday(3),
      "Medium",
      null,
    );

    const insertContact = db.prepare(
      "INSERT INTO contacts (id, customer_id, name, email, role, is_primary) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insertContact.run("ct_northwind", "cust_northwind", "Jordan Lee", "jordan@northwind.example", "Champion", 1);
    insertContact.run("ct_northwind_exec", "cust_northwind", "Morgan Hale", "morgan.hale@northwind.example", "Executive sponsor", 0);
    insertContact.run("ct_acme", "cust_acme", "Priya Shah", "priya@acme.example", "Champion", 1);
    insertContact.run("ct_globex", "cust_globex", "Sam Ortiz", "sam@globex.example", "Champion", 1);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
