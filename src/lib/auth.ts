import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

const COOKIE = "cs_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash?: string;
  expires_at?: string;
};

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  try {
    const actual = scryptSync(password, salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asUser(row: UserRow): SessionUser | null {
  if (row.role !== "owner" && row.role !== "member") return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function countUsers() {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  return row.n;
}

export function listUsers() {
  const rows = getDb()
    .prepare("SELECT id, name, email, role FROM users ORDER BY role = 'owner' DESC, name COLLATE NOCASE")
    .all() as UserRow[];
  return rows.map((row) => asUser(row)).filter((user): user is SessionUser => user !== null);
}

export function findUserByEmail(email: string) {
  const row = getDb()
    .prepare("SELECT id, name, email, role, password_hash FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  if (!row?.password_hash) return null;
  const user = asUser(row);
  if (!user) return null;
  return { ...user, passwordHash: row.password_hash };
}

export function userExists(id: string) {
  const row = getDb().prepare("SELECT id FROM users WHERE id = ?").get(id) as { id: string } | undefined;
  return Boolean(row);
}

export function claimUnassigned(userId: string) {
  const db = getDb();
  db.prepare("UPDATE customers SET owner_id = ? WHERE owner_id IS NULL").run(userId);
  db.prepare("UPDATE tasks SET assignee_id = ? WHERE assignee_id IS NULL").run(userId);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as UserRow | undefined;
  if (!row?.expires_at) return null;
  if (row.expires_at < new Date().toISOString()) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return asUser(row);
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MS).toISOString();
  getDb().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
