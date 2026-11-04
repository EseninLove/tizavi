import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  MOYSKLAD_API,
  probeMoysklad,
  validateMoyskladToken,
  validMoyskladSelection,
} from "../api/_moysklad-client";
const ids = {
  organization: "11111111-1111-1111-1111-111111111111",
  store: "22222222-2222-2222-2222-222222222222",
  price: "33333333-3333-3333-3333-333333333333",
};
const token = "isolated-moysklad-access-token-123456";
function transport(calls: string[], fail = false): typeof fetch {
  return (async (input: any, options: any) => {
    const url = String(input);
    calls.push(url);
    assert.ok(url.startsWith(MOYSKLAD_API + "/"));
    assert.equal(options.method, undefined); // setup never writes to MoySklad
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    if (fail) return new Response(`private ${token}`, { status: 401 });
    if (url.includes("/entity/organization"))
      return Response.json({
        meta: { size: 1 },
        rows: [
          {
            id: ids.organization,
            name: "Моя компания",
            accountId: "must-not-cache",
            meta: { href: "https://attacker.invalid" },
          },
        ],
      });
    if (url.includes("/entity/store"))
      return Response.json({
        rows: [{ id: ids.store, name: "Главный склад" }],
      });
    if (url.includes("/pricetype"))
      return Response.json([{ id: ids.price, name: "Розничная цена" }]);
    if (url.includes("/assortment"))
      return Response.json({ meta: { size: 0 }, rows: [] });
    throw new Error("Unexpected endpoint");
  }) as typeof fetch;
}

test("MoySklad setup reads only fixed-origin endpoints, accepts empty catalogs and sanitizes upstream failures", async () => {
  const calls: string[] = [];
  const result = await probeMoysklad(token, transport(calls));
  assert.equal(calls.length, 4);
  assert.equal(result.catalogCount, 0);
  assert.deepEqual(result.references.organizations, [
    { id: ids.organization, name: "Моя компания" },
  ]);
  assert.ok(
    validMoyskladSelection(result.references, {
      organizationId: ids.organization,
      storeId: ids.store,
      priceTypeId: ids.price,
    }),
  );
  assert.equal(
    validMoyskladSelection(result.references, {
      organizationId: ids.store,
      storeId: ids.store,
      priceTypeId: ids.price,
    }),
    false,
  );
  assert.throws(() =>
    validateMoyskladToken(token + "\r\nAuthorization: secret"),
  );
  await assert.rejects(
    probeMoysklad(token, transport([], true)),
    (e) =>
      e instanceof Error &&
      !e.message.includes(token) &&
      /отклонил/.test(e.message),
  );
  await assert.rejects(
    probeMoysklad(token, (async () => {
      throw new Error(`request included ${token}`);
    }) as typeof fetch),
    (e) => e instanceof Error && !e.message.includes(token),
  );
});

test("MoySklad settings require owner and CSRF, encrypt secrets, preserve working credentials on failed replacement and validate selections", async () => {
  process.env.ADMIN_KEY = "moysklad-isolated-owner";
  process.env.PAYMENT_SETTINGS_KEY = "ab".repeat(32);
  for (const k of [
    "DB_URL",
    "PG_CONNECTION",
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "VERCEL",
  ])
    delete process.env[k];
  const db = new PGlite();
  await db.waitReady;
  await db.exec(
    "CREATE FUNCTION pg_advisory_xact_lock(bigint) RETURNS void LANGUAGE SQL AS $$ SELECT $$;",
  );
  const { pool } = await import("../api/_db");
  const originalConnect = pool.connect.bind(pool);
  const query = async (text: string, values: any[] = []) => {
    if (!values.length && text.split(";").filter((x) => x.trim()).length > 1) {
      const r = await db.exec(text);
      const last = r.at(-1);
      return { rows: last?.rows || [], rowCount: last?.affectedRows || 0 };
    }
    const r = await db.query(text, values);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  (pool as any).connect = async () => ({ query, release() {} });
  const { default: router } = await import("../api/index");
  const origin = {
    host: "shop.example",
    origin: "https://shop.example",
    "x-forwarded-proto": "https",
  };
  const call = async (
    route: string,
    method = "GET",
    body: any = {},
    cookie = "",
    otherHeaders: Record<string, string> = {},
  ) => {
    let data: any;
    const headers: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      status(s: number) {
        this.statusCode = s;
        return this;
      },
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = v;
        return this;
      },
      json(value: any) {
        data = value;
        return this;
      },
    };
    await router(
      {
        method,
        body,
        query: { route },
        headers: { ...origin, cookie, ...otherHeaders },
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res,
    );
    return { data, status: res.statusCode, headers };
  };
  const originalFetch = globalThis.fetch;
  try {
    const login = await call("admin-auth", "POST", {
      adminKey: process.env.ADMIN_KEY,
    });
    assert.equal(login.status, 200);
    const cookie = login.headers["set-cookie"].split(";")[0];
    assert.equal((await call("moysklad")).status, 401);
    const user: any = (
      await query(
        "INSERT INTO users(email,first_name) VALUES('staff@example.invalid','Staff') RETURNING id",
      )
    ).rows[0];
    await query("INSERT INTO admins(user_id,role) VALUES($1,'admin')", [
      user.id,
    ]);
    const staffToken = "cd".repeat(32);
    await query(
      "INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",
      [crypto.createHash("sha256").update(staffToken).digest("hex"), user.id],
    );
    assert.equal(
      (await call("moysklad", "GET", {}, "tizavi_admin=" + staffToken)).status,
      403,
    );
    assert.equal(
      (
        await call("moysklad", "PUT", { action: "token", token }, cookie, {
          origin: "https://attacker.invalid",
        })
      ).status,
      403,
    );
    globalThis.fetch = transport([]);
    const saved = await call(
      "moysklad",
      "PUT",
      { action: "token", token },
      cookie,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.data.tokenSaved, true);
    assert.equal(saved.data.configured, false);
    assert.equal(saved.data.synchronizationEnabled, false);
    assert.ok(!JSON.stringify(saved.data).includes(token));
    const encrypted: any = (
      await query("SELECT token_encrypted FROM moysklad_settings")
    ).rows[0];
    assert.ok(encrypted.token_encrypted.startsWith("master."));
    assert.ok(!encrypted.token_encrypted.includes(token));
    assert.equal(
      (
        await call(
          "moysklad",
          "PUT",
          {
            action: "selection",
            organizationId: ids.store,
            storeId: ids.store,
            priceTypeId: ids.price,
          },
          cookie,
        )
      ).status,
      400,
    );
    const selected = await call(
      "moysklad",
      "PUT",
      {
        action: "selection",
        organizationId: ids.organization,
        storeId: ids.store,
        priceTypeId: ids.price,
      },
      cookie,
    );
    assert.equal(selected.data.configured, true);
    globalThis.fetch = transport([], true);
    assert.equal(
      (await call("moysklad", "PUT", { action: "token", token }, cookie))
        .status,
      400,
    );
    const afterFailure = await call("moysklad", "GET", {}, cookie);
    assert.equal(afterFailure.data.configured, true);
    assert.equal(
      (await query("SELECT token_encrypted FROM moysklad_settings")).rows[0]
        .token_encrypted,
      encrypted.token_encrypted,
    );
    const failedCheck = await call(
      "moysklad",
      "POST",
      { action: "check" },
      cookie,
    );
    assert.equal(failedCheck.status, 400);
    assert.ok(!JSON.stringify(failedCheck.data).includes(token));
    assert.equal(
      (await call("moysklad", "GET", {}, cookie)).data.configured,
      false,
    );
    globalThis.fetch = transport([]);
    assert.equal(
      (await call("moysklad", "POST", { action: "check" }, cookie)).data
        .configured,
      true,
    );
    assert.equal(
      (await call("moysklad", "DELETE", {}, cookie)).data.tokenSaved,
      false,
    );
    assert.equal(
      (await query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n,
      1,
    );
    assert.equal(
      (await query("SELECT COUNT(*)::int AS n FROM products")).rows[0].n,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
    (pool as any).connect = originalConnect;
    await db.close();
  }
});
