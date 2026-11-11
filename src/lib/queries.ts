import "server-only";

import { getDb } from "@/lib/db";
import { daysUntil, renewalWindow, todayIso, isoDaysFromToday } from "@/lib/dates";
import { syncAlerts } from "@/lib/alerts";
import { calculateHealth, type HealthFactor } from "@/lib/health";
import {
  HEALTH,
  type Forecast,
  type Health,
  type Impact,
  type MilestoneStatus,
  type Phase,
  type Priority,
  type RenewalStage,
  type RenewalWindow,
  type Risk,
  type Sentiment,
  type Stage,
  type TaskStatus,
  type WinType,
  type MeetingType,
  type ContactRole,
  isClosedRenewal,
} from "@/lib/constants";

export type Customer = {
  id: string;
  name: string;
  health: Health;
  stage: Stage;
  arr: number;
  renewalDate: string | null;
  primaryContact: string;
  contactEmail: string;
  ownerId: string | null;
  ownerName: string | null;
  daysToRenewal: number | null;
  renewalWindow: RenewalWindow;
  healthFactors: HealthFactor[];
};

export type Renewal = {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  amount: number;
  stage: RenewalStage;
  risk: Risk;
  forecast: Forecast;
  renewalDate: string | null;
  notes: string;
  customerOwnerId: string | null;
  customerOwnerName: string | null;
  daysToRenewal: number | null;
  renewalWindow: RenewalWindow;
};

export type Milestone = {
  id: string;
  customerId: string;
  name: string;
  phase: Phase;
  status: MilestoneStatus;
  targetDate: string | null;
  sortOrder: number;
};

export type Meeting = {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  meetingDate: string;
  type: MeetingType;
  sentiment: Sentiment;
  outcome: string;
  nextSteps: string;
  source: "manual" | "calendar";
};

export type Win = {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  type: WinType;
  impact: Impact;
  arrImpact: number;
  winDate: string;
  summary: string;
};

export type Task = {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: Priority;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  daysUntilDue: number | null;
};

export type Contact = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  role: ContactRole;
  isPrimary: boolean;
};

export type TimelineItem = {
  id: string;
  kind: "meeting" | "win" | "task" | "email";
  date: string | null;
  title: string;
  detail: string;
};

type CustomerRow = {
  id: string;
  name: string;
  health: Health;
  stage: Stage;
  arr: number;
  renewal_date: string | null;
  primary_contact: string;
  contact_email: string;
  owner_id: string | null;
  owner_name: string | null;
};

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    health: row.health,
    stage: row.stage,
    arr: row.arr,
    renewalDate: row.renewal_date,
    primaryContact: row.primary_contact,
    contactEmail: row.contact_email,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    daysToRenewal: row.renewal_date ? daysUntil(row.renewal_date) : null,
    renewalWindow: renewalWindow(row.renewal_date),
    healthFactors: [],
  };
}

function withHealth(customers: Customer[]) {
  if (customers.length === 0) return customers;
  const today = todayIso();
  const risks = getDb()
    .prepare("SELECT customer_id, risk FROM renewals WHERE stage NOT IN ('Closed won', 'Closed lost')")
    .all() as Array<{ customer_id: string; risk: Risk }>;
  const riskRank: Record<Risk, number> = { Low: 0, Medium: 1, High: 2 };
  const riskByCustomer = new Map<string, Risk>();
  for (const row of risks) {
    const current = riskByCustomer.get(row.customer_id);
    if (!current || riskRank[row.risk] > riskRank[current]) riskByCustomer.set(row.customer_id, row.risk);
  }
  const milestones = getDb().prepare("SELECT customer_id, status, target_date FROM milestones").all() as Array<{
    customer_id: string;
    status: string;
    target_date: string | null;
  }>;
  const meetings = getDb()
    .prepare("SELECT customer_id, meeting_date, sentiment FROM meetings WHERE meeting_date <= ? ORDER BY meeting_date DESC")
    .all(today) as Array<{ customer_id: string; meeting_date: string; sentiment: Sentiment }>;
  const sentimentByCustomer = new Map<string, Sentiment>();
  for (const meeting of meetings) {
    if (!sentimentByCustomer.has(meeting.customer_id)) sentimentByCustomer.set(meeting.customer_id, meeting.sentiment);
  }
  const overdue = getDb()
    .prepare("SELECT customer_id, COUNT(*) AS n FROM tasks WHERE status != 'Done' AND due_date IS NOT NULL AND due_date < ? GROUP BY customer_id")
    .all(today) as Array<{ customer_id: string; n: number }>;
  const overdueByCustomer = new Map(overdue.map((row) => [row.customer_id, row.n]));
  const milestonesByCustomer = new Map<string, Array<{ status: string; targetDate: string | null }>>();
  for (const milestone of milestones) {
    const list = milestonesByCustomer.get(milestone.customer_id) ?? [];
    list.push({ status: milestone.status, targetDate: milestone.target_date });
    milestonesByCustomer.set(milestone.customer_id, list);
  }
  const result = customers.map((customer) => {
    const snapshot = calculateHealth({
      today,
      daysToRenewal: customer.daysToRenewal,
      renewalRisk: riskByCustomer.get(customer.id) ?? null,
      milestones: milestonesByCustomer.get(customer.id) ?? [],
      latestSentiment: sentimentByCustomer.get(customer.id) ?? null,
      overdueOpenTasks: overdueByCustomer.get(customer.id) ?? 0,
    });
    return { ...customer, health: snapshot.health, healthFactors: snapshot.factors };
  });
  syncAlerts(result);
  return result;
}

export function listCustomers(filters: { q?: string; health?: string; stage?: string; window?: string; owner?: string }) {
  const q = filters.q?.trim() ?? "";
  const health = filters.health ?? "";
  const stage = filters.stage ?? "";
  const owner = filters.owner ?? "";
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.name, c.health, c.stage, c.arr, c.renewal_date, c.primary_contact, c.contact_email,
              c.owner_id, u.name AS owner_name
       FROM customers c
       LEFT JOIN users u ON u.id = c.owner_id
       WHERE (? = '' OR c.name LIKE '%' || ? || '%' COLLATE NOCASE)
         AND (? = '' OR c.stage = ?)
         AND (? = '' OR c.owner_id = ?)
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(q, q, stage, stage, owner, owner) as CustomerRow[];
  return withHealth(rows.map(mapCustomer)).filter((customer) => {
    if (health && customer.health !== health) return false;
    if (filters.window && customer.renewalWindow !== filters.window) return false;
    return true;
  });
}

export function getCustomer(id: string) {
  const row = getDb()
    .prepare(
      `SELECT c.id, c.name, c.health, c.stage, c.arr, c.renewal_date, c.primary_contact, c.contact_email,
              c.owner_id, u.name AS owner_name
       FROM customers c
       LEFT JOIN users u ON u.id = c.owner_id
       WHERE c.id = ?`,
    )
    .get(id) as CustomerRow | undefined;
  return row ? withHealth([mapCustomer(row)])[0] : null;
}

export function listContacts(customerId: string): Contact[] {
  const rows = getDb()
    .prepare(
      `SELECT id, customer_id, name, email, role, is_primary
       FROM contacts WHERE customer_id = ?
       ORDER BY is_primary DESC, name COLLATE NOCASE`,
    )
    .all(customerId) as Array<{
    id: string;
    customer_id: string;
    name: string;
    email: string;
    role: ContactRole;
    is_primary: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    email: row.email,
    role: row.role,
    isPrimary: row.is_primary === 1,
  }));
}

export function listRenewals() {
  const rows = getDb()
    .prepare(
      `SELECT r.id, r.customer_id, c.name AS customer_name, r.name, r.amount, r.stage, r.risk,
              r.forecast, r.renewal_date, r.notes, c.owner_id AS customer_owner_id, u.name AS customer_owner_name
       FROM renewals r
       JOIN customers c ON c.id = r.customer_id
       LEFT JOIN users u ON u.id = c.owner_id
       ORDER BY r.renewal_date IS NULL, r.renewal_date ASC, c.name COLLATE NOCASE`,
    )
    .all() as Array<{
    id: string;
    customer_id: string;
    customer_name: string;
    name: string;
    amount: number;
    stage: RenewalStage;
    risk: Risk;
    forecast: Forecast;
    renewal_date: string | null;
    notes: string;
    customer_owner_id: string | null;
    customer_owner_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    name: row.name,
    amount: row.amount,
    stage: row.stage,
    risk: row.risk,
    forecast: row.forecast,
    renewalDate: row.renewal_date,
    notes: row.notes,
    customerOwnerId: row.customer_owner_id,
    customerOwnerName: row.customer_owner_name,
    daysToRenewal: row.renewal_date ? daysUntil(row.renewal_date) : null,
    renewalWindow: renewalWindow(row.renewal_date),
  }));
}

export function getRenewal(id: string) {
  return listRenewals().find((renewal) => renewal.id === id) ?? null;
}

export function listMilestones(customerId: string) {
  const rows = getDb()
    .prepare(
      `SELECT id, customer_id, name, phase, status, target_date, sort_order
       FROM milestones WHERE customer_id = ? ORDER BY sort_order ASC`,
    )
    .all(customerId) as Array<{
    id: string;
    customer_id: string;
    name: string;
    phase: Phase;
    status: MilestoneStatus;
    target_date: string | null;
    sort_order: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    phase: row.phase,
    status: row.status,
    targetDate: row.target_date,
    sortOrder: row.sort_order,
  }));
}

export function listMeetings() {
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.customer_id, c.name AS customer_name, m.title, m.meeting_date, m.type,
              m.sentiment, m.outcome, m.next_steps, m.source
       FROM meetings m
       JOIN customers c ON c.id = m.customer_id
       ORDER BY m.meeting_date ASC`,
    )
    .all() as Array<{
    id: string;
    customer_id: string;
    customer_name: string;
    title: string;
    meeting_date: string;
    type: MeetingType;
    sentiment: Sentiment;
    outcome: string;
    next_steps: string;
    source: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    title: row.title,
    meetingDate: row.meeting_date,
    type: row.type,
    sentiment: row.sentiment,
    outcome: row.outcome,
    nextSteps: row.next_steps,
    source: row.source === "calendar" ? ("calendar" as const) : ("manual" as const),
  }));
}

export function listWins() {
  const rows = getDb()
    .prepare(
      `SELECT w.id, w.customer_id, c.name AS customer_name, w.name, w.type, w.impact,
              w.arr_impact, w.win_date, w.summary
       FROM wins w
       JOIN customers c ON c.id = w.customer_id
       ORDER BY w.win_date DESC`,
    )
    .all() as Array<{
    id: string;
    customer_id: string;
    customer_name: string;
    name: string;
    type: WinType;
    impact: Impact;
    arr_impact: number;
    win_date: string;
    summary: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    name: row.name,
    type: row.type,
    impact: row.impact,
    arrImpact: row.arr_impact,
    winDate: row.win_date,
    summary: row.summary,
  }));
}

export function listTasks() {
  const rows = getDb()
    .prepare(
      `SELECT t.id, t.customer_id, c.name AS customer_name, t.title, t.status, t.due_date,
              t.priority, t.completed_at, t.assignee_id, u.name AS assignee_name
       FROM tasks t
       JOIN customers c ON c.id = t.customer_id
       LEFT JOIN users u ON u.id = t.assignee_id
       ORDER BY t.due_date IS NULL, t.due_date ASC, t.title COLLATE NOCASE`,
    )
    .all() as Array<{
    id: string;
    customer_id: string;
    customer_name: string;
    title: string;
    status: TaskStatus;
    due_date: string | null;
    priority: Priority;
    completed_at: string | null;
    assignee_id: string | null;
    assignee_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    priority: row.priority,
    completedAt: row.completed_at,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    daysUntilDue: row.due_date ? daysUntil(row.due_date) : null,
  }));
}

export function listEmails(customerId: string) {
  const rows = getDb()
    .prepare(
      `SELECT id, subject, from_address, sent_at, snippet
       FROM emails WHERE customer_id = ? ORDER BY sent_at DESC`,
    )
    .all(customerId) as Array<{ id: string; subject: string; from_address: string; sent_at: string; snippet: string }>;
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    from: row.from_address,
    sentAt: row.sent_at,
    snippet: row.snippet,
  }));
}

export function getCalendarFeed(userId: string) {
  const row = getDb()
    .prepare("SELECT url, last_synced_at, last_status FROM calendar_feeds WHERE user_id = ?")
    .get(userId) as { url: string; last_synced_at: string | null; last_status: string } | undefined;
  return row ? { url: row.url, lastSyncedAt: row.last_synced_at, lastStatus: row.last_status } : null;
}

export function getMailbox(userId: string) {
  const row = getDb()
    .prepare("SELECT host, port, username, secure, last_synced_at, last_status FROM mailboxes WHERE user_id = ?")
    .get(userId) as
    | { host: string; port: number; username: string; secure: number; last_synced_at: string | null; last_status: string }
    | undefined;
  if (!row) return null;
  return {
    host: row.host,
    port: row.port,
    username: row.username,
    secure: row.secure === 1,
    lastSyncedAt: row.last_synced_at,
    lastStatus: row.last_status,
  };
}

export function listUnmatchedEvents(userId: string) {
  const rows = getDb()
    .prepare(
      `SELECT id, title, meeting_date, attendees
       FROM unmatched_events WHERE user_id = ? ORDER BY meeting_date ASC`,
    )
    .all(userId) as Array<{ id: string; title: string; meeting_date: string; attendees: string }>;
  return rows.map((row) => ({ id: row.id, title: row.title, date: row.meeting_date, attendees: row.attendees }));
}

export function getTimeline(customerId: string): TimelineItem[] {
  const meetings = listMeetings().filter((meeting) => meeting.customerId === customerId);
  const wins = listWins().filter((win) => win.customerId === customerId);
  const tasks = listTasks().filter((task) => task.customerId === customerId && task.status === "Done");
  const emails = listEmails(customerId);
  const items: TimelineItem[] = [
    ...emails.map((email) => ({
      id: email.id,
      kind: "email" as const,
      date: email.sentAt,
      title: email.subject,
      detail: [email.from, email.snippet].filter(Boolean).join(" · "),
    })),
    ...meetings.map((meeting) => ({
      id: meeting.id,
      kind: "meeting" as const,
      date: meeting.meetingDate,
      title: meeting.title,
      detail: [meeting.type, meeting.sentiment, meeting.outcome].filter(Boolean).join(" · "),
    })),
    ...wins.map((win) => ({
      id: win.id,
      kind: "win" as const,
      date: win.winDate,
      title: win.name,
      detail: [win.type, win.summary].filter(Boolean).join(" · "),
    })),
    ...tasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      date: task.completedAt,
      title: task.title,
      detail: "Completed",
    })),
  ];
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

const UPCOMING = new Set<RenewalWindow>(["Overdue", "Next 30 days", "Next 90 days"]);

export function getHome(ownerId: string | null) {
  const customers = listCustomers({ owner: ownerId ?? "" }).filter((customer) => customer.stage !== "Churned");
  const owned = new Set(customers.map((customer) => customer.id));
  const renewals = listRenewals().filter(
    (renewal) => (!ownerId || owned.has(renewal.customerId)) && !isClosedRenewal(renewal.stage) && UPCOMING.has(renewal.renewalWindow),
  );
  const tasks = listTasks().filter((task) => task.status !== "Done" && (!ownerId || task.assigneeId === ownerId));
  const today = todayIso();
  const weekEnd = isoDaysFromToday(6);
  const meetings = listMeetings().filter((meeting) => !ownerId || owned.has(meeting.customerId));
  const meetingsThisWeek = meetings.filter((meeting) => meeting.meetingDate >= today && meeting.meetingDate <= weekEnd);
  const upcomingMeetings = meetings.filter((meeting) => meeting.meetingDate >= today).slice(0, 6);
  const wins = listWins()
    .filter((win) => !ownerId || owned.has(win.customerId))
    .slice(0, 5);
  const atRisk = customers
    .filter((customer) => customer.health === "At risk")
    .sort((a, b) => (a.renewalDate ?? "9999").localeCompare(b.renewalDate ?? "9999"));
  const openAlerts = listOpenAlerts(ownerId);

  const healthChart = HEALTH.map((health) => ({
    label: health,
    value: customers.filter((customer) => customer.health === health).length,
    tone: health === "Healthy" ? "good" : health === "At risk" ? "bad" : "warn",
  }));
  const arrChart = HEALTH.map((health) => ({
    label: health,
    value: customers.filter((customer) => customer.health === health).reduce((sum, customer) => sum + customer.arr, 0),
    tone: health === "Healthy" ? "good" : health === "At risk" ? "bad" : "warn",
  }));

  return {
    atRiskCount: atRisk.length,
    dueCount: renewals.length,
    openTaskCount: tasks.length,
    meetingsThisWeek: meetingsThisWeek.length,
    healthChart,
    arrChart,
    upcomingRenewals: renewals.slice(0, 6),
    atRisk,
    upcomingMeetings,
    openTasks: tasks.slice(0, 6),
    recentWins: wins,
    openAlerts: openAlerts.slice(0, 6),
    openAlertCount: openAlerts.length,
  };
}

export type AccountAlert = {
  id: string;
  customerId: string;
  customerName: string;
  factor: string;
  health: Health;
  detail: string;
  openedAt: string;
};

export function listOpenAlerts(ownerId: string | null): AccountAlert[] {
  const customers = listCustomers({ owner: ownerId ?? "" });
  if (customers.length === 0) return [];
  const names = new Map(customers.map((customer) => [customer.id, customer.name]));
  const placeholders = customers.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT id, customer_id, factor, health, detail, opened_at
       FROM alerts
       WHERE status = 'open' AND customer_id IN (${placeholders})`,
    )
    .all(...customers.map((customer) => customer.id)) as Array<{
    id: string;
    customer_id: string;
    factor: string;
    health: Health;
    detail: string;
    opened_at: string;
  }>;
  const rank: Record<Health, number> = { "At risk": 0, "Needs attention": 1, Healthy: 2 };
  return rows
    .map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: names.get(row.customer_id) ?? "Account",
      factor: row.factor,
      health: row.health,
      detail: row.detail,
      openedAt: row.opened_at,
    }))
    .sort(
      (a, b) =>
        rank[a.health] - rank[b.health] || a.customerName.localeCompare(b.customerName) || a.factor.localeCompare(b.factor),
    );
}
