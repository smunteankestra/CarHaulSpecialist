const encoder = new TextEncoder();

/** Workers caps PBKDF2 at 100,000 iterations. */
export const PBKDF2_ITERATIONS = 100_000;

export type Role = "admin" | "dispatcher";

export const ROLES: Role[] = ["admin", "dispatcher"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
};

export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  role: string;
  password_hash: string;
  salt: string;
  iterations: number;
  active: number;
  created_at: number;
  last_login_at: number | null;
}

export function isRole(value: string): value is Role {
  return value === "admin" || value === "dispatcher";
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = randomHex(16);
  const hash = await derive(password, fromHex(salt), PBKDF2_ITERATIONS);
  return { hash, salt, iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(password: string, user: Pick<UserRow, "password_hash" | "salt" | "iterations">): Promise<boolean> {
  const candidate = await derive(password, fromHex(user.salt), user.iterations);
  if (candidate.length !== user.password_hash.length) return false;
  let diff = 0;
  for (let index = 0; index < candidate.length; index += 1) diff |= candidate.charCodeAt(index) ^ user.password_hash.charCodeAt(index);
  return diff === 0;
}

/** Readable, unguessable password for a new staff account. */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${body.slice(0, 4)}-${body.slice(4, 9)}-${body.slice(9)}`;
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email.trim().toLowerCase()).first<UserRow>();
}

export async function listUsers(db: D1Database): Promise<UserRow[]> {
  const { results } = await db.prepare("SELECT * FROM users ORDER BY role, email").all<UserRow>();
  return results;
}

export async function createUser(
  db: D1Database,
  input: { email: string; name: string; role: Role; password: string },
): Promise<UserRow> {
  const { hash, salt, iterations } = await hashPassword(input.password);
  const email = input.email.trim().toLowerCase();

  await db
    .prepare(
      `INSERT INTO users (email, name, role, password_hash, salt, iterations, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         role = excluded.role,
         password_hash = excluded.password_hash,
         salt = excluded.salt,
         iterations = excluded.iterations,
         active = 1`,
    )
    .bind(email, input.name || null, input.role, hash, salt, iterations, Date.now())
    .run();

  const user = await findUserByEmail(db, email);
  if (!user) throw new Error("user insert failed");
  return user;
}

export async function setPassword(db: D1Database, userId: number, password: string): Promise<void> {
  const { hash, salt, iterations } = await hashPassword(password);
  await db
    .prepare("UPDATE users SET password_hash = ?, salt = ?, iterations = ? WHERE id = ?")
    .bind(hash, salt, iterations, userId)
    .run();
}

export async function setActive(db: D1Database, userId: number, active: boolean): Promise<void> {
  await db.prepare("UPDATE users SET active = ? WHERE id = ?").bind(active ? 1 : 0, userId).run();
}

export async function touchLogin(db: D1Database, userId: number): Promise<void> {
  await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(Date.now(), userId).run();
}

export async function countActiveAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1")
    .first<{ count: number }>();
  return row?.count ?? 0;
}
