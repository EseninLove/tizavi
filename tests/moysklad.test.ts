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
    assert.equal(options.headers.Accept, "application/json;charset=utf-8");
    assert.equal(options.headers["Accept-Encoding"], "gzip");
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
  await db.exec(
    "CREATE FUNCTION pg_try_advisory_lock(bigint) RETURNS boolean LANGUAGE SQL AS $$ SELECT TRUE $$; CREATE FUNCTION pg_advisory_unlock(bigint) RETURNS boolean LANGUAGE SQL AS $$ SELECT TRUE $$;",
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
    queryValues: Record<string, string> = {},
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
        query: { route, ...queryValues },
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
    const category = (
      await query(
        "INSERT INTO categories(slug,name,image,sort_order) VALUES('stable-category','Овощи','saved-photo',7) RETURNING id",
      )
    ).rows[0] as any;
    let folders: any[] = [];
    let writes = 0;
    let failFolders = false;
    let loseResponse = true;
    const baseTransport = transport([]);
    globalThis.fetch = (async (input: any, opts: any) => {
      const url = String(input);
      if (!url.includes("/productfolder")) return baseTransport(input, opts);
      assert.equal(opts.headers.Accept, "application/json;charset=utf-8");
      if (failFolders) return new Response("private " + token, { status: 503 });
      if (opts.method === "POST") {
        const body = JSON.parse(opts.body);
        writes++;
        assert.ok(!folders.some((f) => f.externalCode === body.externalCode));
        assert.equal(body.id, undefined);
        body.id = crypto.randomUUID();
        folders.push(body);
        if (loseResponse) {
          loseResponse = false;
          throw new Error("Lost response " + token);
        }
        return Response.json(body);
      }
      const id = url.split("/productfolder/")[1];
      if (id) {
        const found = folders.find((f) => f.id === id);
        return found ? Response.json(found) : new Response("", { status: 404 });
      }
      return Response.json({ rows: folders, meta: { size: folders.length } });
    }) as typeof fetch;
    // A remote write succeeded but its reply was lost; the retry must recover the same external code.
    const lost = await call(
      "moysklad",
      "POST",
      { action: "categories-export" },
      cookie,
    );
    assert.equal(lost.status, 503);
    assert.ok(!JSON.stringify(lost.data).includes(token));
    const recovered = await call(
      "moysklad",
      "POST",
      { action: "categories-export" },
      cookie,
    );
    assert.equal(recovered.status, 200, JSON.stringify(recovered.data));
    assert.equal(writes, 1);
    assert.equal(recovered.data.categoriesEnabled, true);
    const mapped = (
      await query("SELECT * FROM categories WHERE id=$1", [category.id])
    ).rows[0] as any;
    assert.equal(mapped.moysklad_id, folders[0].id);
    folders[0].name = "Свежие овощи";
    folders.push({
      id: "44444444-4444-4444-4444-444444444444",
      name: "Новая группа",
    });
    assert.equal(
      (await call("moysklad", "POST", { action: "categories-sync" }, cookie))
        .status,
      200,
    );
    const renamed = (
      await query("SELECT * FROM categories WHERE id=$1", [category.id])
    ).rows[0] as any;
    assert.equal(renamed.slug, "stable-category");
    assert.equal(renamed.name, "Свежие овощи");
    assert.equal(renamed.image, "saved-photo");
    assert.equal(renamed.sort_order, 7);
    assert.equal(
      (await query("SELECT COUNT(*)::int AS n FROM categories")).rows[0].n,
      2,
    );
    folders[0].archived = true;
    assert.equal(
      (await call("moysklad", "POST", { action: "categories-sync" }, cookie))
        .status,
      200,
    );
    assert.equal(
      (
        await query("SELECT moysklad_hidden FROM categories WHERE id=$1", [
          category.id,
        ])
      ).rows[0].moysklad_hidden,
      true,
    );
    assert.equal((await call("categories")).data.categories.length, 1);
    folders[0].archived = false;
    assert.equal(
      (await call("moysklad", "POST", { action: "categories-sync" }, cookie))
        .status,
      200,
    );
    const currencyId = "66666666-6666-6666-6666-666666666666";
    const productId = "77777777-7777-7777-7777-777777777777";
    const sourceProduct: any = {
      id: productId,
      name: "Импортированный товар",
      description: "Описание",
      uom: { name: "шт" },
      productFolder: { id: folders[0].id },
      salePrices: [
        {
          value: 19995,
          priceType: { id: ids.price },
          currency: { id: currencyId },
        },
      ],
      images: {
        rows: [
          {
            updated: "v1",
            miniature: {
              downloadHref: `https://miniature-prod.moysklad.ru/miniature/${ids.organization}/documentminiature/${ids.store}`,
            },
          },
        ],
      },
    };
    let productRows: any[] = [sourceProduct],
      stockFailure = false,
      stockAmount = 5;
    const categoriesTransport = globalThis.fetch;
    globalThis.fetch = (async (input: any, opts: any) => {
      const url = String(input);
      if (url.startsWith("https://miniature-prod.moysklad.ru/")) {
        assert.equal(opts.headers, undefined);
        return new Response(Buffer.from("89504e470d0a1a0a", "hex"));
      }
      if (url.includes("/entity/currency?"))
        return Response.json({
          rows: [{ id: currencyId, code: "643", isoCode: "RUB" }],
        });
      if (url.includes("/entity/product?"))
        return Response.json({ rows: productRows });
      if (url.includes("/report/stock/all?")) {
        assert.ok(
          decodeURIComponent(url).includes("/entity/store/" + ids.store),
        );
        return stockFailure
          ? new Response("secret upstream", { status: 503 })
          : Response.json({
              rows: [
                {
                  meta: { href: `${MOYSKLAD_API}/entity/product/${productId}` },
                  stock: stockAmount,
                  reserve: 2,
                  inTransit: 100,
                },
              ],
            });
      }
      return categoriesTransport(input, opts);
    }) as typeof fetch;
    const imported = await call(
      "moysklad",
      "POST",
      { action: "products-sync" },
      cookie,
    );
    assert.equal(imported.status, 200, JSON.stringify(imported.data));
    assert.equal(imported.data.productResult.created, 1);
    assert.equal(imported.data.productsEnabled, true);
    const first = (
      await query("SELECT * FROM products WHERE moysklad_id=$1", [productId])
    ).rows[0] as any;
    assert.equal(Number(first.price), 199.95);
    assert.equal(Number(first.stock_available), 3);
    assert.equal(first.in_stock, true);
    assert.ok(first.image.startsWith("/api/product-image?id="));
    assert.equal(
      (await query("SELECT COUNT(*)::int AS n FROM moysklad_product_images"))
        .rows[0].n,
      1,
    );
    await query(
      "UPDATE products SET rating=4,reviews_count=2,popular=TRUE,old_price=250 WHERE id=$1",
      [first.id],
    );
    sourceProduct.name = "Новое название";
    sourceProduct.productFolder = { id: folders[1].id };
    sourceProduct.salePrices[0].value = 30050;
    const repeated = await call(
      "moysklad",
      "POST",
      { action: "products-sync" },
      cookie,
    );
    assert.equal(repeated.data.productResult.created, 0);
    const changed = (
      await query("SELECT * FROM products WHERE id=$1", [first.id])
    ).rows[0] as any;
    assert.equal(changed.name, "Новое название");
    assert.equal(Number(changed.price), 300.5);
    assert.equal(changed.rating, 4);
    assert.equal(changed.reviews_count, 2);
    assert.equal(changed.popular, true);
    assert.equal(changed.old_price, null);
    assert.notEqual(changed.category, first.category);
    stockFailure = true;
    sourceProduct.name = "Не применять";
    assert.equal(
      (await call("moysklad", "POST", { action: "products-sync" }, cookie))
        .status,
      503,
    );
    assert.equal(
      (await query("SELECT name FROM products WHERE id=$1", [first.id])).rows[0]
        .name,
      "Новое название",
    );
    stockFailure = false;
    stockAmount = 0;
    assert.equal(
      (await call("moysklad", "POST", { action: "products-sync" }, cookie))
        .status,
      200,
    );
    assert.equal((await call("products")).data.products[0].in_stock, false);
    stockAmount = 5;
    sourceProduct.salePrices = [];
    assert.equal(
      (await call("moysklad", "POST", { action: "products-sync" }, cookie))
        .status,
      200,
    );
    assert.ok(
      (
        await query("SELECT moysklad_issue FROM products WHERE id=$1", [
          first.id,
        ])
      ).rows[0].moysklad_issue,
    );
    sourceProduct.archived = true;
    assert.equal(
      (await call("moysklad", "POST", { action: "products-sync" }, cookie))
        .status,
      200,
    );
    assert.equal((await call("products")).data.products.length, 0);
    productRows = [];
    assert.equal(
      (await call("moysklad", "POST", { action: "products-sync" }, cookie))
        .status,
      200,
    );
    assert.equal(
      (await query("SELECT COUNT(*)::int AS n FROM products")).rows[0].n,
      1,
    );
    assert.equal(
      (await call("moysklad", "PUT", { action: "products-pause" }, cookie)).data
        .productsEnabled,
      false,
    );
    const { syncMoyskladProducts } = await import("../api/_moysklad-products");
    assert.deepEqual(await syncMoyskladProducts(true), { skipped: true });
    failFolders = true;
    assert.equal(
      (await call("moysklad", "POST", { action: "categories-sync" }, cookie))
        .status,
      503,
    );
    assert.equal((await call("categories")).data.categories.length, 2); // failed reads never hide categories
    failFolders = false;
    folders = [];
    assert.equal(
      (await call("moysklad", "POST", { action: "categories-sync" }, cookie))
        .status,
      200,
    );
    assert.equal((await call("categories")).data.categories.length, 0);
    assert.equal(
      (await query("SELECT COUNT(*)::int AS n FROM categories")).rows[0].n,
      2,
    ); // never physically delete
    assert.equal(
      (await call("moysklad", "PUT", { action: "categories-pause" }, cookie))
        .data.categoriesEnabled,
      false,
    );
    const { syncMoyskladCategories } =
      await import("../api/_moysklad-categories");
    assert.deepEqual(await syncMoyskladCategories(false, true), {
      skipped: true,
    });
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
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
    (pool as any).connect = originalConnect;
    await db.close();
  }
});
