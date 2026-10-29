import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
test("staff account migration preserves legacy roles and links only matching registered accounts", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    for (const version of [
      "001-base",
      "002-commerce",
      "003-accounts",
      "004-profile",
      "005-privacy",
      "006-security",
      "007-staff",
    ])
      await db.exec(
        fs.readFileSync(
          path.join(process.cwd(), "db", version + ".sql"),
          "utf8",
        ),
      );
    await db.exec(
      "INSERT INTO users(telegram_id,first_name) VALUES(22,'Existing owner'); INSERT INTO admins(telegram_id,role) VALUES(22,'super_admin'),(33,'catalog_manager'); INSERT INTO orders(order_number,total,payable_total,user_id,status) VALUES('PRESERVED-STAFF-UPGRADE',300,300,1,'pending');",
    );
    await db.query(
      "INSERT INTO admin_sessions(token_hash,telegram_id,key_version,expires_at) VALUES($1,22,NULL,NOW()+INTERVAL '1 hour'),($2,33,NULL,NOW()+INTERVAL '1 hour'),($3,NULL,'owner-key-version',NOW()+INTERVAL '1 hour')",
      ["a".repeat(64), "b".repeat(64), "c".repeat(64)],
    );
    await db.exec(
      fs.readFileSync(
        path.join(process.cwd(), "db", "008-staff-accounts.sql"),
        "utf8",
      ),
    );
    const rows = (
      await db.query<any>(
        "SELECT telegram_id,user_id,role FROM admins ORDER BY telegram_id",
      )
    ).rows;
    assert.equal(rows[0].user_id, 1);
    assert.equal(rows[0].role, "super_admin");
    assert.equal(rows[1].user_id, null);
    assert.equal(rows[1].role, "catalog_manager");
    const sessions = (
      await db.query<any>(
        "SELECT token_hash,user_id,key_version FROM admin_sessions ORDER BY token_hash",
      )
    ).rows;
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].user_id, 1);
    assert.equal(sessions[1].key_version, "owner-key-version");
    assert.equal(
      (
        await db.query(
          "SELECT 1 FROM orders WHERE order_number='PRESERVED-STAFF-UPGRADE'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("SELECT 1 FROM users")).rows.length,
      1,
      "migration does not invent unregistered accounts",
    );
  } finally {
    await db.close();
  }
});
