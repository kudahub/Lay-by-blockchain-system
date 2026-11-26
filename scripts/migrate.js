import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requirePool } from "../db/pool.js";

const pool = requirePool();
const migrationPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../db/migrations/001_initial.sql");

try {
  await pool.query(await readFile(migrationPath, "utf8"));
  console.log("Database migration completed.");
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
