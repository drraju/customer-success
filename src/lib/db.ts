import "server-only";

import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { seedIfEmpty } from "@/lib/seed";

const globalForDb = globalThis as unknown as { csDb?: DatabaseSync };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  health TEXT NOT NULL,
  stage TEXT NOT NULL,
  arr INTEGER NOT NULL DEFAULT 0,
  renewal_date TEXT,
  primary_contact TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS renewals (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL,
  risk TEXT NOT NULL,
  forecast TEXT NOT NULL,
  renewal_date TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  target_date TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  type TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT '',
  next_steps TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS wins (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  impact TEXT NOT NULL,
  arr_impact INTEGER NOT NULL DEFAULT 0,
  win_date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT,
  priority TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  last_synced_at TEXT,
  last_status TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mailboxes (
  user_id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password_enc TEXT NOT NULL,
  secure INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  last_status TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS unmatched_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  external_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  attendees TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  UNIQUE(user_id, external_uid)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Other',
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_address TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL,
  snippet TEXT NOT NULL DEFAULT '',
  UNIQUE(customer_id, external_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  factor TEXT NOT NULL,
  health TEXT NOT NULL,
  detail TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  dismissed_at TEXT,
  UNIQUE(customer_id, factor)
);
`;

function backfillContacts(db: DatabaseSync) {
  const rows = db
    .prepare(
      `SELECT id, primary_contact, contact_email FROM customers c
       WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE customer_id = c.id)
         AND (primary_contact != '' OR contact_email != '')`,
    )
    .all() as Array<{ id: string; primary_contact: string; contact_email: string }>;
  const insert = db.prepare(
    "INSERT INTO contacts (id, customer_id, name, email, role, is_primary) VALUES (?, ?, ?, ?, 'Champion', 1)",
  );
  for (const row of rows) {
    insert.run(crypto.randomUUID(), row.id, row.primary_contact || row.contact_email, row.contact_email.trim().toLowerCase());
  }
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb() {
  if (!globalForDb.csDb) {
    const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "cs.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(SCHEMA);
    ensureColumn(db, "customers", "owner_id", "TEXT");
    ensureColumn(db, "tasks", "assignee_id", "TEXT");
    ensureColumn(db, "meetings", "external_uid", "TEXT");
    ensureColumn(db, "meetings", "source", "TEXT NOT NULL DEFAULT 'manual'");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS meetings_external_uid ON meetings(external_uid) WHERE external_uid IS NOT NULL");
    backfillContacts(db);
    seedIfEmpty(db);
    globalForDb.csDb = db;
  }
  return globalForDb.csDb;
}
