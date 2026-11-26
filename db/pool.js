import pg from "pg";

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

export function requirePool() {
  if (!pool) {
    const error = new Error("Database is not configured. Set DATABASE_URL in .env.");
    error.status = 503;
    throw error;
  }
  return pool;
}
