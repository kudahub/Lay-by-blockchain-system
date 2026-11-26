import "dotenv/config";
import { randomUUID, scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { requirePool } from "../db/pool.js";

const scrypt = promisify(scryptCallback);
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;

if (!email || !name || !password || password.length < 12) {
  throw new Error("Set ADMIN_EMAIL, ADMIN_NAME, and an ADMIN_PASSWORD of at least 12 characters in .env.");
}

const salt = randomBytes(16);
const derived = Buffer.from(await scrypt(password, salt, 64));
const passwordHash = `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
const pool = requirePool();

try {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount) throw new Error("An account with ADMIN_EMAIL already exists; refusing to change its role.");
  await pool.query(
    "INSERT INTO users (id, email, full_name, role, password_hash) VALUES ($1,$2,$3,'admin',$4)",
    [randomUUID(), email, name, passwordHash],
  );
  console.log(`Administrator account created for ${email}.`);
} finally {
  await pool.end();
}
