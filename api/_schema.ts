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
    for (const version of [
      "001-base",
      "002-commerce",
      "003-accounts",
      "004-profile",
      "005-privacy",
      "006-security",
    ]) {
      const found = await client.query(
        "SELECT 1 FROM shop_migrations WHERE version=$1",
        [version],
      );
      if (!found.rowCount) {
        await client.query(
          fs.readFileSync(
            path.join(process.cwd(), "db", version + ".sql"),
            "utf8",
          ),
        );
        await client.query("INSERT INTO shop_migrations(version) VALUES($1)", [
          version,
        ]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
