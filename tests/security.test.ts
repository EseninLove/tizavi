import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("administrative sessions enforce owner permissions, CSRF, expiry, revocation and bounded login", async () => {
  process.env.ADMIN_KEY = "isolated-security-owner-key";
  process.env.BOT_TOKEN = "isolated-security-bot";
  delete process.env.VERCEL;
  for (const key of [
    "DB_URL",
    "PG_CONNECTION",
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
  ])
    delete process.env[key];
  const db = new PGlite();
  await db.waitReady;
  await db.exec(
    "CREATE FUNCTION pg_advisory_xact_lock(bigint) RETURNS void LANGUAGE SQL AS $$ SELECT $$;",
  );
  const { pool } = await import("../api/_db");
  const original = pool.connect.bind(pool);
  const query = async (text: string, values: unknown[] = []) => {
    if (!values.length && text.split(";").filter((x) => x.trim()).length > 1) {
      const result = await db.exec(text);
      const last = result.at(-1);
      return { rows: last?.rows || [], rowCount: last?.affectedRows || 0 };
    }
    const result = await db.query(text, values);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  };
  (pool as any).connect = async () => ({ query, release() {} });
  const { default: login } = await import("../api/_routes/admin-auth");
  const { default: admins } = await import("../api/_routes/admins/index");
  const { default: seed } = await import("../api/_routes/seed");
  const { default: router } = await import("../api/index");
  const { authenticateAdmin } = await import("../api/_helpers");
  const { validAdminKey, limitRequest, clientAddress } =
    await import("../api/_security");
  const { default: webhook } = await import("../api/_routes/payment-webhook");
  const origin = {
    host: "shop.example",
    origin: "https://shop.example",
    "x-forwarded-proto": "https",
  };
  const call = async (
    handler: any,
    method: string,
    body: any = {},
    headers: any = {},
    params: any = {},
  ) => {
    let result: any;
    const responseHeaders: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: string) {
        responseHeaders[k.toLowerCase()] = v;
        return this;
      },
      status(s: number) {
        this.statusCode = s;
        return this;
      },
      json(b: any) {
        result = b;
        return this;
      },
      send(b: any) {
        result = b;
        return this;
      },
      end() {
        return this;
      },
    };
    await handler(
      {
        method,
        body,
        headers,
        query: params,
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res,
    );
    return { status: res.statusCode, body: result, headers: responseHeaders };
  };
  const signed = (id: number, age = 0) => {
    const p = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000) - age),
      user: JSON.stringify({ id }),
    });
    const data = [...p.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.BOT_TOKEN!)
      .digest();
    p.set(
      "hash",
      crypto.createHmac("sha256", secret).update(data).digest("hex"),
    );
    return p.toString();
  };
  try {
    assert.equal(
      clientAddress({
        headers: { "x-forwarded-for": "spoofed" },
        socket: { remoteAddress: "trusted-socket" },
      } as any),
      "trusted-socket",
    );
    for (const value of [undefined, "", " \t "]) {
      if (value === undefined) delete process.env.ADMIN_KEY;
      else process.env.ADMIN_KEY = value;
      assert.equal(validAdminKey(" \t "), false);
      assert.equal(
        (
          await authenticateAdmin({
            method: "GET",
            headers: { "x-admin-auth": "Key \t ignored" },
          } as any)
        ).authorized,
        false,
      );
    }
    process.env.ADMIN_KEY = "isolated-security-owner-key";
    assert.equal(
      (await call(login, "POST", { adminKey: process.env.ADMIN_KEY })).status,
      403,
      "login must require Origin",
    );
    assert.equal(
      (
        await call(
          login,
          "POST",
          { adminKey: process.env.ADMIN_KEY },
          { ...origin, origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    const owner = await call(
      login,
      "POST",
      { adminKey: process.env.ADMIN_KEY },
      origin,
    );
    assert.equal(owner.status, 200);
    assert.match(owner.headers["set-cookie"], /HttpOnly/);
    const stored = (await query("SELECT token_hash FROM admin_sessions"))
      .rows[0].token_hash;
    assert.equal(
      stored,
      crypto
        .createHash("sha256")
        .update(owner.headers["set-cookie"].split(";")[0].split("=")[1])
        .digest("hex"),
    );
    assert.match(owner.headers["set-cookie"], /Secure/);
    assert.match(owner.headers["set-cookie"], /Max-Age=28800/);
    const cookie = owner.headers["set-cookie"].split(";")[0];
    const ownerHeaders = { ...origin, cookie };
    assert.equal(
      (await call(login, "GET", {}, ownerHeaders)).body.user.role,
      "super_admin",
    );
    assert.equal(
      (
        await call(
          admins,
          "POST",
          { telegramId: 101, role: "super_admin" },
          ownerHeaders,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          admins,
          "POST",
          { telegramId: 102, role: "admin" },
          ownerHeaders,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          admins,
          "POST",
          { telegramId: 103, role: "unexpected" },
          ownerHeaders,
        )
      ).status,
      400,
    );
    assert.equal(
      (await call(admins, "POST", { telegramId: 103 }, { cookie })).status,
      403,
      "mutations require matching Origin",
    );
    assert.equal(
      (
        await call(
          admins,
          "POST",
          { telegramId: 103 },
          { ...ownerHeaders, origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          admins,
          "GET",
          {},
          { "x-admin-auth": "Key " + process.env.ADMIN_KEY },
        )
      ).status,
      403,
      "raw key no longer authorizes API calls",
    );
    assert.equal(
      (await call(login, "POST", { initData: signed(102, 600) }, origin))
        .status,
      401,
      "old Telegram data cannot mint an admin session",
    );
    const staff = await call(login, "POST", { initData: signed(102) }, origin);
    assert.equal(staff.status, 200);
    const staffHeaders = {
      ...origin,
      cookie: staff.headers["set-cookie"].split(";")[0],
    };
    assert.equal((await call(admins, "GET", {}, staffHeaders)).status, 403);
    assert.equal(
      (
        await call(
          admins,
          "POST",
          { telegramId: 104, role: "super_admin" },
          staffHeaders,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call(seed, "POST", { telegramId: 104 }, staffHeaders)).status,
      403,
    );
    delete process.env.ENABLE_CATALOG_SEED;
    assert.equal(
      (await call(seed, "POST", { telegramId: 104 }, ownerHeaders)).status,
      403,
    );
    const ownerId = Number(
      (await query("SELECT id FROM admins WHERE telegram_id=101")).rows[0].id,
    );
    assert.equal(
      (await call(admins, "DELETE", {}, ownerHeaders, { id: String(ownerId) }))
        .status,
      409,
      "last owner is protected",
    );
    // Role changes are checked against the current database record on every request.
    await query("UPDATE admins SET role='super_admin' WHERE telegram_id=102");
    assert.equal(
      (await call(login, "GET", {}, staffHeaders)).body.user.role,
      "super_admin",
    );
    await query("UPDATE admins SET role='admin' WHERE telegram_id=102");
    assert.equal((await call(admins, "GET", {}, staffHeaders)).status, 403);
    const staffId = Number(
      (await query("SELECT id FROM admins WHERE telegram_id=102")).rows[0].id,
    );
    assert.equal(
      (await call(admins, "DELETE", {}, ownerHeaders, { id: String(staffId) }))
        .status,
      200,
    );
    assert.equal(
      (await call(login, "GET", {}, staffHeaders)).body.user,
      null,
      "removal revokes existing sessions",
    );
    // Central audit never saves request bodies, passwords or payment credentials.
    assert.equal(
      (
        await call(router, "PUT", { name: "Local category" }, ownerHeaders, {
          route: "categories",
          id: "999",
        })
      ).status,
      200,
    );
    assert.ok(
      (await query("SELECT 1 FROM admin_audit WHERE action='PUT:categories'"))
        .rows.length,
    );
    const before = (await query("SELECT COUNT(*) AS count FROM admin_audit"))
      .rows[0].count;
    assert.ok(Number(before) > 0);
    assert.ok(
      !(await query("SELECT * FROM admin_audit")).rows.some((r) =>
        JSON.stringify(r).includes(process.env.ADMIN_KEY!),
      ),
    );
    assert.equal(
      (await call(login, "POST", { action: "logout" }, ownerHeaders)).status,
      200,
    );
    assert.equal(
      (await call(login, "GET", {}, ownerHeaders)).body.user,
      null,
      "logout revokes token server-side",
    );
    const second = await call(
      login,
      "POST",
      { adminKey: process.env.ADMIN_KEY },
      origin,
    );
    const secondHeaders = {
      ...origin,
      cookie: second.headers["set-cookie"].split(";")[0],
    };
    process.env.ADMIN_KEY = "rotated-key";
    assert.equal(
      (await call(login, "GET", {}, secondHeaders)).body.user,
      null,
      "key rotation invalidates old sessions",
    );
    process.env.ADMIN_KEY = "isolated-security-owner-key";
    await query(
      "UPDATE admin_sessions SET expires_at=NOW()-INTERVAL '1 second'",
    );
    assert.equal((await call(login, "GET", {}, secondHeaders)).body.user, null);
    for (let i = 0; i < 2; i++)
      await limitRequest("isolated-limit", "user", 2, 60);
    await assert.rejects(
      () => limitRequest("isolated-limit", "user", 2, 60),
      (e: any) => e.status === 429,
    );
    await query(
      "UPDATE request_limits SET started_at=NOW()-INTERVAL '2 minutes'",
    );
    await limitRequest("isolated-limit", "user", 2, 60);
    await query("DELETE FROM request_limits");
    for (let i = 0; i < 20; i++)
      assert.equal(
        (await call(login, "POST", { adminKey: "wrong" }, origin)).status,
        401,
      );
    assert.equal(
      (await call(login, "POST", { adminKey: "wrong" }, origin)).status,
      429,
    );
    // A forged T-Bank notification is rejected before any reconciliation/network call.
    process.env.TBANK_TERMINAL_KEY = "dummy-terminal";
    process.env.TBANK_PASSWORD = "dummy-password";
    process.env.PUBLIC_APP_URL = "https://shop.example";
    assert.equal(
      (
        await call(webhook, "POST", {
          PaymentId: "fake",
          Token: "0".repeat(64),
        })
      ).status,
      403,
    );
    const { tbankToken } = await import("../api/_payment-provider");
    const bankBody = {
      TerminalKey: "dummy-terminal",
      PaymentId: "unknown",
      Success: true,
      Status: "CONFIRMED",
    };
    const validNotice = await call(webhook, "POST", {
      ...bankBody,
      Token: tbankToken(bankBody, "dummy-password"),
    });
    assert.equal(validNotice.status, 200);
    assert.equal(validNotice.body, "OK");
  } finally {
    (pool as any).connect = original;
    await db.close();
    await pool.end();
  }
});
