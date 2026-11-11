"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  claimUnassigned,
  clearSession,
  countUsers,
  findUserByEmail,
  getCurrentUser,
  hashPassword,
  isEmail,
  listUsers,
  normalizeEmail,
  startSession,
  userExists,
  verifyPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addYears, todayIso } from "@/lib/dates";
import { encryptSecret } from "@/lib/secret";
import { syncCalendar, syncMailbox } from "@/lib/sync";
import {
  FORECASTS,
  IMPACTS,
  MEETING_TYPES,
  MILESTONE_STATUSES,
  PHASES,
  CONTACT_ROLES,
  PRIORITIES,
  RENEWAL_STAGES,
  RISKS,
  SENTIMENTS,
  STAGES,
  TASK_STATUSES,
  WIN_TYPES,
  isClosedRenewal,
  isOneOf,
} from "@/lib/constants";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function amount(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function dateOrNull(formData: FormData, key: string) {
  const value = field(formData, key);
  return value || null;
}

function refresh() {
  revalidatePath("/", "layout");
}

async function actor() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

function chosenUser(value: string, fallback: string) {
  return userExists(value) ? value : fallback;
}

function savePrimaryContact(customerId: string, name: string, email: string) {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const primary = db.prepare("SELECT id FROM contacts WHERE customer_id = ? AND is_primary = 1").get(customerId) as { id: string } | undefined;
  if (!name && !normalized) {
    if (primary) db.prepare("DELETE FROM contacts WHERE id = ?").run(primary.id);
    return;
  }
  const label = name || normalized;
  if (primary) {
    db.prepare("UPDATE contacts SET name = ?, email = ? WHERE id = ?").run(label, normalized, primary.id);
    return;
  }
  db.prepare("INSERT INTO contacts (id, customer_id, name, email, role, is_primary) VALUES (?, ?, ?, ?, 'Champion', 1)").run(
    crypto.randomUUID(),
    customerId,
    label,
    normalized,
  );
}

export async function createOwner(formData: FormData) {
  if (countUsers() > 0) redirect("/login");
  const name = field(formData, "name");
  const email = normalizeEmail(field(formData, "email"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!name || !isEmail(email) || password.length < 8 || password !== confirm) {
    redirect("/setup?error=1");
  }
  const id = crypto.randomUUID();
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)")
    .run(id, name, email, hashPassword(password), new Date().toISOString());
  claimUnassigned(id);
  await startSession(id);
  refresh();
  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = normalizeEmail(field(formData, "email"));
  const password = String(formData.get("password") ?? "");
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) redirect("/login?error=1");
  await startSession(user.id);
  redirect("/");
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}

export async function addMember(formData: FormData) {
  const current = await actor();
  if (current.role !== "owner") redirect("/team");
  const name = field(formData, "name");
  const email = normalizeEmail(field(formData, "email"));
  const password = String(formData.get("password") ?? "");
  if (!name || !isEmail(email) || password.length < 8) redirect("/team?error=invalid");
  if (findUserByEmail(email)) redirect("/team?error=email");
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'member', ?)")
    .run(crypto.randomUUID(), name, email, hashPassword(password), new Date().toISOString());
  refresh();
  redirect("/team?added=1");
}

export async function removeMember(formData: FormData) {
  const current = await actor();
  const id = field(formData, "id");
  if (current.role !== "owner" || !id || id === current.id) return;
  const target = listUsers().find((user) => user.id === id);
  if (!target) return;
  const owners = listUsers().filter((user) => user.role === "owner").length;
  if (target.role === "owner" && owners <= 1) return;
  const db = getDb();
  db.prepare("UPDATE customers SET owner_id = ? WHERE owner_id = ?").run(current.id, id);
  db.prepare("UPDATE tasks SET assignee_id = ? WHERE assignee_id = ?").run(current.id, id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM calendar_feeds WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM mailboxes WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM unmatched_events WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  refresh();
}

export async function changePassword(formData: FormData) {
  const current = await actor();
  const existing = findUserByEmail(current.email);
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!existing || !verifyPassword(password, existing.passwordHash) || next.length < 8 || next !== confirm) {
    redirect("/team?error=password");
  }
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), current.id);
  refresh();
  redirect("/team?password=1");
}

function insertStandardPlan(customerId: string) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO milestones (id, customer_id, name, phase, status, target_date, sort_order)
     VALUES (?, ?, ?, ?, 'Not started', NULL, ?)`,
  );
  PHASES.forEach((phase, index) => {
    insert.run(crypto.randomUUID(), customerId, phase, phase, index);
  });
}

export async function createCustomer(formData: FormData) {
  const name = field(formData, "name");
  const stage = field(formData, "stage");
  const arr = amount(formData, "arr");
  const renewalDate = dateOrNull(formData, "renewalDate");
  const primaryContact = field(formData, "primaryContact");
  if (!name || !isOneOf(stage, STAGES)) {
    redirect("/customers/new?error=missing");
  }
  const current = await actor();
  const ownerId = chosenUser(field(formData, "ownerId"), current.id);

  const id = crypto.randomUUID();
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO customers (id, name, health, stage, arr, renewal_date, primary_contact, contact_email, created_at, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
    ).run(id, name, "Healthy", stage, arr, renewalDate, primaryContact, new Date().toISOString(), ownerId);
    if (primaryContact) savePrimaryContact(id, primaryContact, "");
    db.prepare(
      `INSERT INTO renewals (id, customer_id, name, amount, stage, risk, forecast, renewal_date, notes)
       VALUES (?, ?, ?, ?, 'Not started', 'Low', 'Pipeline', ?, '')`,
    ).run(crypto.randomUUID(), id, `${name} renewal`, arr, renewalDate);
    insertStandardPlan(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  refresh();
  redirect(`/customers/${id}?tab=plan`);
}

export async function updateCustomer(formData: FormData) {
  const id = field(formData, "id");
  const stage = field(formData, "stage");
  const arr = amount(formData, "arr");
  const renewalDate = dateOrNull(formData, "renewalDate");
  const primaryContact = field(formData, "primaryContact");
  const contactEmail = field(formData, "contactEmail");
  if (!id || !isOneOf(stage, STAGES)) return;
  const current = await actor();
  const ownerId = chosenUser(field(formData, "ownerId"), current.id);
  const db = getDb();
  db.prepare(
    `UPDATE customers
     SET stage = ?, arr = ?, renewal_date = ?, primary_contact = ?, contact_email = ?, owner_id = ?
     WHERE id = ?`,
  ).run(stage, arr, renewalDate, primaryContact, contactEmail, ownerId, id);
  savePrimaryContact(id, primaryContact, contactEmail);
  db.prepare(
    `UPDATE renewals SET renewal_date = ?
     WHERE customer_id = ? AND stage NOT IN ('Closed won', 'Closed lost')`,
  ).run(renewalDate, id);
  refresh();
}

export async function deleteCustomer(formData: FormData) {
  const id = field(formData, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM customers WHERE id = ?").run(id);
  refresh();
  redirect("/customers");
}

export async function addStandardPlan(formData: FormData) {
  const customerId = field(formData, "customerId");
  if (!customerId) return;
  const db = getDb();
  const existing = db.prepare("SELECT COUNT(*) AS n FROM milestones WHERE customer_id = ?").get(customerId) as { n: number };
  if (existing.n > 0) return;
  insertStandardPlan(customerId);
  refresh();
}

export async function updateMilestone(formData: FormData) {
  const id = field(formData, "id");
  const status = field(formData, "status");
  const targetDate = dateOrNull(formData, "targetDate");
  if (!id || !isOneOf(status, MILESTONE_STATUSES)) return;
  getDb().prepare("UPDATE milestones SET status = ?, target_date = ? WHERE id = ?").run(status, targetDate, id);
  refresh();
}

export async function createMeeting(formData: FormData) {
  const customerId = field(formData, "customerId");
  const title = field(formData, "title");
  const meetingDate = field(formData, "meetingDate");
  const type = field(formData, "type");
  const sentiment = field(formData, "sentiment");
  const outcome = field(formData, "outcome");
  const nextSteps = field(formData, "nextSteps");
  if (!customerId || !title || !meetingDate || !isOneOf(type, MEETING_TYPES) || !isOneOf(sentiment, SENTIMENTS)) return;
  getDb()
    .prepare(
      `INSERT INTO meetings (id, customer_id, title, meeting_date, type, sentiment, outcome, next_steps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(crypto.randomUUID(), customerId, title, meetingDate, type, sentiment, outcome, nextSteps);
  refresh();
}

export async function deleteMeeting(formData: FormData) {
  const id = field(formData, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM meetings WHERE id = ?").run(id);
  refresh();
}

export async function createWin(formData: FormData) {
  const customerId = field(formData, "customerId");
  const name = field(formData, "name");
  const type = field(formData, "type");
  const impact = field(formData, "impact");
  const arrImpact = amount(formData, "arrImpact");
  const winDate = field(formData, "winDate");
  const summary = field(formData, "summary");
  if (!customerId || !name || !winDate || !isOneOf(type, WIN_TYPES) || !isOneOf(impact, IMPACTS)) return;
  getDb()
    .prepare(
      `INSERT INTO wins (id, customer_id, name, type, impact, arr_impact, win_date, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(crypto.randomUUID(), customerId, name, type, impact, arrImpact, winDate, summary);
  refresh();
}

export async function deleteWin(formData: FormData) {
  const id = field(formData, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM wins WHERE id = ?").run(id);
  refresh();
}

export async function createTask(formData: FormData) {
  const customerId = field(formData, "customerId");
  const title = field(formData, "title");
  const dueDate = dateOrNull(formData, "dueDate");
  const priority = field(formData, "priority");
  if (!customerId || !title || !isOneOf(priority, PRIORITIES)) return;
  const current = await actor();
  const assigneeId = chosenUser(field(formData, "assigneeId"), current.id);
  getDb()
    .prepare(
      `INSERT INTO tasks (id, customer_id, title, status, due_date, priority, completed_at, assignee_id)
       VALUES (?, ?, ?, 'Not started', ?, ?, NULL, ?)`,
    )
    .run(crypto.randomUUID(), customerId, title, dueDate, priority, assigneeId);
  refresh();
}

export async function updateTaskAssignee(formData: FormData) {
  const id = field(formData, "id");
  const assigneeId = field(formData, "assigneeId");
  if (!id || !userExists(assigneeId)) return;
  await actor();
  getDb().prepare("UPDATE tasks SET assignee_id = ? WHERE id = ?").run(assigneeId, id);
  refresh();
}

export async function updateTaskStatus(formData: FormData) {
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (!id || !isOneOf(status, TASK_STATUSES)) return;
  if (status === "Done") {
    getDb()
      .prepare("UPDATE tasks SET status = ?, completed_at = COALESCE(completed_at, ?) WHERE id = ?")
      .run(status, todayIso(), id);
  } else {
    getDb().prepare("UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?").run(status, id);
  }
  refresh();
}

export async function deleteTask(formData: FormData) {
  const id = field(formData, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  refresh();
}

function applyRenewalOutcome(renewalId: string, previousStage: string, nextStage: string) {
  if (isClosedRenewal(previousStage) || !isClosedRenewal(nextStage)) return;
  const db = getDb();
  const renewal = db
    .prepare(
      `SELECT r.customer_id, r.amount, r.renewal_date, c.name AS customer_name, c.arr, c.stage
       FROM renewals r JOIN customers c ON c.id = r.customer_id
       WHERE r.id = ?`,
    )
    .get(renewalId) as
    | { customer_id: string; amount: number; renewal_date: string | null; customer_name: string; arr: number; stage: string }
    | undefined;
  if (!renewal) return;

  if (nextStage === "Closed lost") {
    db.prepare("UPDATE customers SET stage = 'Churned', renewal_date = NULL WHERE id = ?").run(renewal.customer_id);
    return;
  }

  const nextDate = addYears(renewal.renewal_date || todayIso(), 1);
  const amount = renewal.amount > 0 ? renewal.amount : renewal.arr;
  const open = db
    .prepare("SELECT COUNT(*) AS n FROM renewals WHERE customer_id = ? AND stage NOT IN ('Closed won', 'Closed lost')")
    .get(renewal.customer_id) as { n: number };
  if (open.n === 0) {
    db.prepare(
      `INSERT INTO renewals (id, customer_id, name, amount, stage, risk, forecast, renewal_date, notes)
       VALUES (?, ?, ?, ?, 'Not started', 'Low', 'Pipeline', ?, '')`,
    ).run(crypto.randomUUID(), renewal.customer_id, `${renewal.customer_name} renewal`, amount, nextDate);
  }
  if (renewal.stage === "Churned") {
    db.prepare("UPDATE customers SET renewal_date = ?, arr = ?, stage = 'Value' WHERE id = ?").run(nextDate, amount, renewal.customer_id);
    return;
  }
  db.prepare("UPDATE customers SET renewal_date = ?, arr = ? WHERE id = ?").run(nextDate, amount, renewal.customer_id);
}

export async function updateRenewal(formData: FormData) {
  const id = field(formData, "id");
  const stage = field(formData, "stage");
  const risk = field(formData, "risk");
  const forecast = field(formData, "forecast");
  const value = amount(formData, "amount");
  const renewalDate = dateOrNull(formData, "renewalDate");
  const notes = field(formData, "notes");
  if (!id || !isOneOf(stage, RENEWAL_STAGES) || !isOneOf(risk, RISKS) || !isOneOf(forecast, FORECASTS)) return;
  const db = getDb();
  const existing = db.prepare("SELECT customer_id, stage FROM renewals WHERE id = ?").get(id) as
    | { customer_id: string; stage: string }
    | undefined;
  if (!existing) return;
  db.prepare(
    `UPDATE renewals SET amount = ?, stage = ?, risk = ?, forecast = ?, renewal_date = ?, notes = ? WHERE id = ?`,
  ).run(value, stage, risk, forecast, renewalDate, notes, id);
  if (!isClosedRenewal(stage)) {
    db.prepare("UPDATE customers SET renewal_date = ? WHERE id = ?").run(renewalDate, existing.customer_id);
  } else {
    applyRenewalOutcome(id, existing.stage, stage);
  }
  refresh();
}

export async function updateRenewalStage(formData: FormData) {
  const id = field(formData, "id");
  const stage = field(formData, "stage");
  if (!id || !isOneOf(stage, RENEWAL_STAGES)) return;
  const db = getDb();
  const existing = db.prepare("SELECT stage FROM renewals WHERE id = ?").get(id) as { stage: string } | undefined;
  if (!existing) return;
  db.prepare("UPDATE renewals SET stage = ? WHERE id = ?").run(stage, id);
  applyRenewalOutcome(id, existing.stage, stage);
  refresh();
}

export async function createRenewal(formData: FormData) {
  const customerId = field(formData, "customerId");
  const value = amount(formData, "amount");
  const renewalDate = dateOrNull(formData, "renewalDate");
  if (!customerId) return;
  const db = getDb();
  const customer = db.prepare("SELECT name FROM customers WHERE id = ?").get(customerId) as { name: string } | undefined;
  if (!customer) return;
  const open = db
    .prepare("SELECT COUNT(*) AS n FROM renewals WHERE customer_id = ? AND stage NOT IN ('Closed won', 'Closed lost')")
    .get(customerId) as { n: number };
  if (open.n > 0) return;
  db.prepare(
    `INSERT INTO renewals (id, customer_id, name, amount, stage, risk, forecast, renewal_date, notes)
     VALUES (?, ?, ?, ?, 'Not started', 'Low', 'Pipeline', ?, '')`,
  ).run(crypto.randomUUID(), customerId, `${customer.name} renewal`, value, renewalDate);
  db.prepare("UPDATE customers SET renewal_date = ? WHERE id = ?").run(renewalDate, customerId);
  refresh();
}

export async function deleteRenewal(formData: FormData) {
  const id = field(formData, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM renewals WHERE id = ?").run(id);
  refresh();
  redirect("/renewals");
}

function feedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

export async function saveCalendarFeed(formData: FormData) {
  const user = await actor();
  const url = feedUrl(field(formData, "url"));
  if (!url) redirect("/sync?error=calendar");
  getDb()
    .prepare(
      `INSERT INTO calendar_feeds (user_id, url, last_synced_at, last_status)
       VALUES (?, ?, NULL, '')
       ON CONFLICT(user_id) DO UPDATE SET url = excluded.url`,
    )
    .run(user.id, url);
  refresh();
  redirect("/sync?saved=calendar");
}

export async function runCalendarSync() {
  const user = await actor();
  await syncCalendar(user.id);
  refresh();
  redirect("/sync");
}

export async function assignEvent(formData: FormData) {
  const user = await actor();
  const id = field(formData, "id");
  const customerId = field(formData, "customerId");
  if (!id || !customerId) return;
  const db = getDb();
  const event = db
    .prepare("SELECT external_uid, title, meeting_date, details FROM unmatched_events WHERE id = ? AND user_id = ?")
    .get(id, user.id) as { external_uid: string; title: string; meeting_date: string; details: string } | undefined;
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId) as { id: string } | undefined;
  if (!event || !customer) return;
  const existing = db.prepare("SELECT id FROM meetings WHERE external_uid = ?").get(event.external_uid) as { id: string } | undefined;
  if (!existing) {
    db.prepare(
      `INSERT INTO meetings (id, customer_id, title, meeting_date, type, sentiment, outcome, next_steps, external_uid, source)
       VALUES (?, ?, ?, ?, 'Other', 'Neutral', ?, '', ?, 'calendar')`,
    ).run(crypto.randomUUID(), customerId, event.title, event.meeting_date, event.details, event.external_uid);
  }
  db.prepare("DELETE FROM unmatched_events WHERE id = ?").run(id);
  refresh();
}

export async function dismissEvent(formData: FormData) {
  const user = await actor();
  const id = field(formData, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM unmatched_events WHERE id = ? AND user_id = ?").run(id, user.id);
  refresh();
}

export async function saveMailbox(formData: FormData) {
  const user = await actor();
  const host = field(formData, "host");
  const username = field(formData, "username");
  const port = Number(formData.get("port"));
  const password = String(formData.get("password") ?? "");
  const secure = formData.get("secure") === "1" ? 1 : 0;
  if (!host || !username || !Number.isInteger(port) || port < 1 || port > 65535) redirect("/sync?error=mail");
  const db = getDb();
  const existing = db.prepare("SELECT password_enc FROM mailboxes WHERE user_id = ?").get(user.id) as { password_enc: string } | undefined;
  const passwordEnc = password ? encryptSecret(password) : existing?.password_enc;
  if (!passwordEnc) redirect("/sync?error=mail");
  db.prepare(
    `INSERT INTO mailboxes (user_id, host, port, username, password_enc, secure, last_synced_at, last_status)
     VALUES (?, ?, ?, ?, ?, ?, NULL, '')
     ON CONFLICT(user_id) DO UPDATE SET host = excluded.host, port = excluded.port, username = excluded.username,
       password_enc = excluded.password_enc, secure = excluded.secure`,
  ).run(user.id, host, port, username, passwordEnc, secure);
  refresh();
  redirect("/sync?saved=mail");
}

export async function runMailSync() {
  const user = await actor();
  await syncMailbox(user.id);
  refresh();
  redirect("/sync");
}

export async function createContact(formData: FormData) {
  await actor();
  const customerId = field(formData, "customerId");
  const name = field(formData, "name");
  const email = field(formData, "email").toLowerCase();
  const role = field(formData, "role");
  if (!customerId || !name || !isOneOf(role, CONTACT_ROLES)) return;
  if (email && !isEmail(email)) return;
  const db = getDb();
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
  if (!customer) return;
  if (email) {
    const taken = db.prepare("SELECT id FROM contacts WHERE customer_id = ? AND lower(email) = ?").get(customerId, email);
    if (taken) return;
  }
  const count = db.prepare("SELECT COUNT(*) AS n FROM contacts WHERE customer_id = ?").get(customerId) as { n: number };
  const primary = count.n === 0;
  db.prepare("INSERT INTO contacts (id, customer_id, name, email, role, is_primary) VALUES (?, ?, ?, ?, ?, ?)").run(
    crypto.randomUUID(),
    customerId,
    name,
    email,
    role,
    primary ? 1 : 0,
  );
  if (primary) db.prepare("UPDATE customers SET primary_contact = ?, contact_email = ? WHERE id = ?").run(name, email, customerId);
  refresh();
}

export async function makePrimaryContact(formData: FormData) {
  await actor();
  const id = field(formData, "id");
  const db = getDb();
  const row = db.prepare("SELECT customer_id, name, email FROM contacts WHERE id = ?").get(id) as
    | { customer_id: string; name: string; email: string }
    | undefined;
  if (!row) return;
  db.prepare("UPDATE contacts SET is_primary = 0 WHERE customer_id = ?").run(row.customer_id);
  db.prepare("UPDATE contacts SET is_primary = 1 WHERE id = ?").run(id);
  db.prepare("UPDATE customers SET primary_contact = ?, contact_email = ? WHERE id = ?").run(row.name, row.email, row.customer_id);
  refresh();
}

export async function deleteContact(formData: FormData) {
  await actor();
  const id = field(formData, "id");
  const db = getDb();
  const row = db.prepare("SELECT customer_id, is_primary FROM contacts WHERE id = ?").get(id) as
    | { customer_id: string; is_primary: number }
    | undefined;
  if (!row) return;
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
  if (row.is_primary === 1) {
    const next = db
      .prepare("SELECT id FROM contacts WHERE customer_id = ? ORDER BY name COLLATE NOCASE LIMIT 1")
      .get(row.customer_id) as { id: string } | undefined;
    if (next) db.prepare("UPDATE contacts SET is_primary = 1 WHERE id = ?").run(next.id);
  }
  const primary = db.prepare("SELECT name, email FROM contacts WHERE customer_id = ? AND is_primary = 1").get(row.customer_id) as
    | { name: string; email: string }
    | undefined;
  db.prepare("UPDATE customers SET primary_contact = ?, contact_email = ? WHERE id = ?").run(
    primary?.name ?? "",
    primary?.email ?? "",
    row.customer_id,
  );
  refresh();
}

export async function dismissAlert(formData: FormData) {
  await actor();
  const id = field(formData, "id");
  getDb()
    .prepare("UPDATE alerts SET status = 'dismissed', dismissed_at = ? WHERE id = ? AND status = 'open'")
    .run(new Date().toISOString(), id);
  refresh();
}
