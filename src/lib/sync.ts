import "server-only";

import { ImapFlow } from "imapflow";
import { MEETING_TYPES, type MeetingType } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isoDaysFromToday, todayIso } from "@/lib/dates";
import { parseIcs, type CalendarEvent } from "@/lib/ics";
import { decryptSecret } from "@/lib/secret";

export type SyncResult = { added: number; updated: number; unmatched: number; skipped: number };

function customersByEmail() {
  const rows = getDb()
    .prepare(
      `SELECT customer_id AS id, email, is_primary FROM contacts WHERE trim(email) != ''
       UNION ALL
       SELECT id, contact_email AS email, 1 AS is_primary FROM customers WHERE trim(contact_email) != ''
       ORDER BY is_primary DESC, id`,
    )
    .all() as Array<{ id: string; email: string }>;
  const map = new Map<string, string>();
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (email && !map.has(email)) map.set(email, row.id);
  }
  return map;
}

function meetingType(title: string): MeetingType {
  const text = title.toLowerCase();
  if (text.includes("qbr") || text.includes("business review")) return "QBR";
  if (text.includes("renew")) return "Renewal";
  if (text.includes("exec")) return "Executive";
  if (text.includes("onboard") || text.includes("kickoff")) return "Onboarding";
  if (text.includes("check")) return "Check-in";
  return "Other";
}

function inWindow(date: string) {
  return date >= isoDaysFromToday(-60) && date <= isoDaysFromToday(180);
}

export function applyCalendar(userId: string, events: CalendarEvent[]): SyncResult {
  const db = getDb();
  const accounts = customersByEmail();
  const existing = db.prepare("SELECT id FROM meetings WHERE external_uid = ?");
  const update = db.prepare("UPDATE meetings SET title = ?, meeting_date = ? WHERE external_uid = ?");
  const insert = db.prepare(
    `INSERT INTO meetings (id, customer_id, title, meeting_date, type, sentiment, outcome, next_steps, external_uid, source)
     VALUES (?, ?, ?, ?, ?, 'Neutral', ?, '', ?, 'calendar')`,
  );
  const upsertUnmatched = db.prepare(
    `INSERT INTO unmatched_events (id, user_id, external_uid, title, meeting_date, attendees, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, external_uid) DO UPDATE SET
       title = excluded.title, meeting_date = excluded.meeting_date, attendees = excluded.attendees, details = excluded.details`,
  );
  const clearUnmatched = db.prepare("DELETE FROM unmatched_events WHERE user_id = ? AND external_uid = ?");
  const result: SyncResult = { added: 0, updated: 0, unmatched: 0, skipped: 0 };

  for (const event of events) {
    if (!inWindow(event.date)) {
      result.skipped += 1;
      continue;
    }
    const customerId = event.emails.map((email) => accounts.get(email)).find((id) => id);
    const found = existing.get(event.uid) as { id: string } | undefined;
    if (found) {
      update.run(event.title, event.date, event.uid);
      clearUnmatched.run(userId, event.uid);
      result.updated += 1;
      continue;
    }
    if (!customerId) {
      upsertUnmatched.run(crypto.randomUUID(), userId, event.uid, event.title, event.date, event.emails.join(", "), event.description);
      result.unmatched += 1;
      continue;
    }
    const type = meetingType(event.title);
    if (!MEETING_TYPES.includes(type)) continue;
    insert.run(crypto.randomUUID(), customerId, event.title, event.date, type, event.description, event.uid);
    clearUnmatched.run(userId, event.uid);
    result.added += 1;
  }
  return result;
}

export async function syncCalendar(userId: string) {
  const db = getDb();
  const feed = db.prepare("SELECT url FROM calendar_feeds WHERE user_id = ?").get(userId) as { url: string } | undefined;
  if (!feed) return "Add a calendar address first.";
  let url: URL;
  try {
    url = new URL(feed.url);
  } catch {
    return "That calendar address is not a valid URL.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Use an http or https calendar address.";
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (!response.ok) return `The calendar address returned ${response.status}.`;
    const text = await response.text();
    if (text.length > 1_000_000) return "That calendar file is too large.";
    if (!text.includes("BEGIN:VCALENDAR")) return "That address did not return a calendar.";
    const result = applyCalendar(userId, parseIcs(text));
    const status = `Added ${result.added}, updated ${result.updated}, ${result.unmatched} need an account.`;
    db.prepare("UPDATE calendar_feeds SET last_synced_at = ?, last_status = ? WHERE user_id = ?").run(new Date().toISOString(), status, userId);
    return status;
  } catch {
    const status = "Could not download that calendar.";
    db.prepare("UPDATE calendar_feeds SET last_status = ? WHERE user_id = ?").run(status, userId);
    return status;
  }
}

type MailMessage = {
  externalId: string;
  subject: string;
  from: string;
  to: string[];
  sentAt: string;
};

export function applyMail(messages: MailMessage[]) {
  const db = getDb();
  const accounts = customersByEmail();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO emails (id, customer_id, external_id, subject, from_address, sent_at, snippet)
     VALUES (?, ?, ?, ?, ?, ?, '')`,
  );
  let added = 0;
  let skipped = 0;
  for (const message of messages) {
    const matches = [...new Set([message.from, ...message.to].map((email) => accounts.get(email.trim().toLowerCase())).filter((id) => id))] as string[];
    if (matches.length === 0) {
      skipped += 1;
      continue;
    }
    for (const customerId of matches) {
      const result = insert.run(crypto.randomUUID(), customerId, message.externalId, message.subject.slice(0, 200), message.from, message.sentAt);
      if (result.changes > 0) added += 1;
    }
  }
  return { added, skipped };
}

function mailFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "AUTHENTICATIONFAILED" || /auth/i.test(message)) return "The mail server rejected the username or password.";
  if (/timed out|timeout/i.test(message)) return "The mail server did not respond in time.";
  if (/ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|getaddrinfo/i.test(message)) return "Could not reach the mail server.";
  return "Could not sync mail.";
}

export async function syncMailbox(userId: string) {
  const db = getDb();
  const mailbox = db
    .prepare("SELECT host, port, username, password_enc, secure FROM mailboxes WHERE user_id = ?")
    .get(userId) as { host: string; port: number; username: string; password_enc: string; secure: number } | undefined;
  if (!mailbox) return "Add a mailbox first.";
  const client = new ImapFlow({
    host: mailbox.host,
    port: mailbox.port,
    secure: mailbox.secure === 1,
    auth: { user: mailbox.username, pass: decryptSecret(mailbox.password_enc) },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
  let lock: { release: () => void } | undefined;
  try {
    await client.connect();
    lock = await client.getMailboxLock("INBOX");
    const since = new Date();
    since.setDate(since.getDate() - 21);
    const found = await client.search({ since }, { uid: true });
    const uids = (Array.isArray(found) ? found : []).slice(-40);
    const messages: MailMessage[] = [];
    if (uids.length > 0) {
      for await (const msg of client.fetch(uids, { envelope: true, uid: true }, { uid: true })) {
        const envelope = msg.envelope;
        const from = envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        const to = [...(envelope?.to ?? []), ...(envelope?.cc ?? [])].map((item) => item.address?.toLowerCase() ?? "").filter(Boolean);
        const sent = envelope?.date instanceof Date ? envelope.date.toISOString().slice(0, 10) : todayIso();
        const externalId = envelope?.messageId || `uid:${msg.uid}`;
        messages.push({ externalId, subject: envelope?.subject || "(no subject)", from, to, sentAt: sent });
      }
    }
    const result = applyMail(messages);
    const status = `Added ${result.added} emails. ${result.skipped} did not match an account.`;
    db.prepare("UPDATE mailboxes SET last_synced_at = ?, last_status = ? WHERE user_id = ?").run(new Date().toISOString(), status, userId);
    return status;
  } catch (error) {
    const status = mailFailure(error);
    db.prepare("UPDATE mailboxes SET last_status = ? WHERE user_id = ?").run(status, userId);
    return status;
  } finally {
    lock?.release();
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}
