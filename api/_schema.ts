import { pool } from "./_db.js";
import fs from "node:fs";
import path from "node:path";
let ready: Promise<void> | undefined;
/** Versioned migration under a database lock; safe across serverless instances. */
export function ensureCommerceSchema(): Promise<void> {
  if (!ready)
    ready = migrate().catch((error) => {
      ready = undefined;
      throw error;
    });
  return ready;
}
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(78264321)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS shop_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())",
    );
    const found = await client.query(
      "SELECT 1 FROM shop_migrations WHERE version='002-commerce'",
    );
    if (!found.rowCount) {
      const file = path.join(process.cwd(), "db", "002-commerce.sql");
      await client.query(fs.readFileSync(file, "utf8"));
      await client.query(
        "INSERT INTO shop_migrations(version) VALUES('002-commerce')",
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
