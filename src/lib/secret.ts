import "server-only";

import fs from "fs";
import path from "path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const database = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "cs.db");
  const file = path.join(path.dirname(database), "secret");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, randomBytes(32), { mode: 0o600 });
  }
  const stored = fs.readFileSync(file);
  if (stored.length !== 32) throw new Error("The local secret file is unusable.");
  return stored;
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptSecret(stored: string) {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
