import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { calculateItems, paymentMatches, canFulfil } from "../api/_commerce";
import { deliveryEstimate } from "../api/_delivery";
import { matchesProduct } from "../src/utils/search";
import { tbankToken } from "../api/_payment-provider";
import { encryptCredentials } from "../api/_payment-config";
import { formatPrice } from "../src/utils/format";

test("provider signatures exclude nested data and stored secrets are encrypted with fresh nonces", () => {
  assert.equal(
    tbankToken(
      {
        TerminalKey: "terminal",
        Amount: 9450,
        OrderId: "order",
        Token: "ignored",
        DATA: { email: "nested" },
      },
      "password",
    ),
    crypto
      .createHash("sha256")
      .update("9450orderpasswordterminal")
      .digest("hex"),
  );
  const previous = process.env.PAYMENT_SETTINGS_KEY;
  process.env.PAYMENT_SETTINGS_KEY = "ab".repeat(32);
  try {
    const first = encryptCredentials({ secretKey: "private-secret" });
    const second = encryptCredentials({ secretKey: "private-secret" });
    assert.notEqual(first, second);
    assert.equal(first.includes("private-secret"), false);
    assert.match(formatPrice(94.5), /94,5/);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_SETTINGS_KEY;
    else process.env.PAYMENT_SETTINGS_KEY = previous;
  }
});

const product = {
  id: 1,
  name: "Яблоки",
  price: 189,
  unit: "кг",
  in_stock: true,
};
test("server prices ignore client fields and preserve fractional kopecks", () => {
  const result = calculateItems(
    [{ productId: 1, quantity: 0.5, price: 1 }],
    [product],
  );
  assert.equal(result.subtotalMinor, 9450);
  for (const quantity of [-1, 0, 0.1, NaN, 1001])
    assert.throws(() =>
      calculateItems([{ productId: 1, quantity }], [product]),
    );
  assert.throws(() =>
    calculateItems(
      [{ productId: 1, quantity: 1 }],
      [{ ...product, in_stock: false }],
    ),
  );
  assert.throws(() =>
    calculateItems(
      [
        { productId: 1, quantity: 1 },
        { productId: 1, quantity: 1 },
      ],
      [product],
    ),
  );
});
test("payment verification requires provider ID, currency, amount and intent ownership", () => {
  const intent = { id: "local", provider_id: "remote", amount_minor: 9450 };
  const payment = {
    id: "remote",
    amount: { value: "94.50", currency: "RUB" },
    metadata: { intent_id: "local" },
  };
  assert.equal(paymentMatches(payment, intent), true);
  for (const changed of [
    { ...payment, id: "other" },
    { ...payment, amount: { value: "1.00", currency: "RUB" } },
    { ...payment, amount: { value: "94.50", currency: "USD" } },
    { ...payment, metadata: { intent_id: "other" } },
  ])
    assert.equal(paymentMatches(changed, intent), false);
  assert.equal(canFulfil("paid", "pending"), false);
  assert.equal(canFulfil("cancelled", "succeeded"), false);
});
test("delivery uses nearest eligible warehouse, configured tariff, Moscow opening time", () => {
  const w = {
    id: 1,
    name: "Центр",
    active: true,
    courier_count: 1,
    latitude: 55.75,
    longitude: 37.62,
    radius_km: 30,
    preparation_minutes: 30,
    open_hour: 9,
    close_hour: 22,
  };
  const settings = {
    base_fee: 290,
    per_km: 10,
    free_from: 5000,
    speed_kmh: 20,
    road_factor: 1.4,
  };
  const point = { latitude: 55.75, longitude: 37.62 };
  assert.equal(
    deliveryEstimate(
      [w],
      point,
      settings,
      10000,
      new Date("2026-10-06T05:00:00Z"),
    ).earliestAt,
    "2026-10-06T06:30:00.000Z",
  );
  assert.equal(deliveryEstimate([w], point, settings, 500000).fee, 0);
  assert.throws(() =>
    deliveryEstimate([{ ...w, courier_count: 0 }], point, settings, 0),
  );
  assert.throws(() =>
    deliveryEstimate([w], { latitude: 60, longitude: 40 }, settings, 0),
  );
});
test("search supports typos, aliases and brand metadata", () => {
  const p = {
    ...product,
    id: "1",
    name: "Помидоры",
    description: "Красные овощи",
    brand: "Ферма",
    synonyms: "томаты",
  } as any;
  assert.equal(matchesProduct(p, "томаты ферма"), true);
  assert.equal(matchesProduct(p, "помидры"), true);
  assert.equal(matchesProduct(p, "бананы"), false);
});

test("database and API payment lifecycle rejects forged activation and applies real confirmation once", async () => {
  process.env.ADMIN_KEY = "local-test-admin";
  process.env.BOT_TOKEN = "local-test-bot";
  process.env.DADATA_TOKEN = "local-test-address";
  process.env.YOOKASSA_SHOP_ID = "test-shop";
  process.env.YOOKASSA_SECRET_KEY = "test-secret";
  process.env.PUBLIC_APP_URL = "https://shop.example";
  const db = new PGlite();
  await db.waitReady;
  // PGlite has no concurrent clients. Integration tests exercise actual SQL sequentially;
  // production locking is supplied by PostgreSQL's advisory/row locks.
  await db.exec(
    "CREATE FUNCTION pg_advisory_xact_lock(bigint) RETURNS void LANGUAGE SQL AS $$ SELECT $$;",
  );
  const { pool } = await import("../api/_db");
  let failOrderSave = false;
  const query = async (text: string, values: unknown[] = []) => {
    if (failOrderSave && /INSERT INTO orders/i.test(text))
      throw new Error("Simulated storage failure");
    if (!values.length && text.split(";").filter((s) => s.trim()).length > 1) {
      const rows = await db.exec(text);
      const last = rows[rows.length - 1];
      return { rows: last?.rows || [], rowCount: last?.affectedRows || 0 };
    }
    const result = await db.query(text, values);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  };
  const originalConnect = pool.connect.bind(pool);
  (pool as any).connect = async () => ({ query, release() {} });
  const originalFetch = globalThis.fetch;
  const remote = new Map<string, any>();
  let remoteCount = 0;
  let forgedAmount = false;
  globalThis.fetch = async (input: any, options: any) => {
    const url = String(input),
      body = options?.body ? JSON.parse(options.body) : {};
    if (url.includes("dadata.ru"))
      return new Response(
        JSON.stringify({
          suggestions: [
            {
              value: "г Москва, ул Тверская, д 1",
              data: {
                house: "1",
                fias_id: "11111111-1111-1111-1111-111111111111",
                region_kladr_id: "7700000000000",
                geo_lat: "55.75",
                geo_lon: "37.62",
                city: "Москва",
              },
            },
          ],
        }),
        { status: 200 },
      );
    if (url.endsWith("/v3/payments")) {
      const idempotence = options.headers["Idempotence-Key"];
      let payment = [...remote.values()].find(
        (p) => p.metadata.intent_id === idempotence,
      );
      if (!payment) {
        payment = {
          id: `remote-${++remoteCount}`,
          amount: body.amount,
          metadata: body.metadata,
          status: "pending",
          paid: false,
          confirmation: {
            confirmation_url: "https://payment.example/checkout",
          },
        };
        remote.set(payment.id, payment);
      }
      return new Response(JSON.stringify(payment), { status: 200 });
    }
    if (url.includes("/v3/payments/")) {
      const payment = remote.get(url.split("/").pop()!);
      return new Response(
        JSON.stringify({
          ...payment,
          ...(forgedAmount
            ? { amount: { value: "1.00", currency: "RUB" } }
            : {}),
        }),
        { status: 200 },
      );
    }
    throw new Error("Unexpected external request: " + url);
  };
  const call = async (
    handler: any,
    method: string,
    body: any = {},
    params: any = {},
    admin = false,
  ) => {
    let status = 200,
      result: any;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(data: any) {
        result = JSON.parse(JSON.stringify(data));
        return this;
      },
      send(data: any) {
        result = data;
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
        query: params,
        headers: admin ? { "x-admin-auth": "Key local-test-admin" } : {},
      },
      res,
    );
    return { status, body: result };
  };
  function init(userId = 101) {
    const data = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: userId, first_name: "Покупатель" }),
    });
    const check = [...data.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.BOT_TOKEN!)
      .digest();
    data.set(
      "hash",
      crypto.createHmac("sha256", secret).update(check).digest("hex"),
    );
    return data.toString();
  }
  try {
    const seed = (await import("../api/seed")).default,
      subscription = (await import("../api/subscription")).default,
      orders = (await import("../api/orders/index")).default,
      myOrders = (await import("../api/my-orders")).default,
      categories = (await import("../api/categories/index")).default,
      reviews = (await import("../api/reviews")).default,
      products = (await import("../api/products/index")).default;
    const { createPayment, reconcilePayment } =
      await import("../api/_payments");
    const seeded = await call(seed, "POST", {}, {}, true);
    assert.equal(seeded.status, 200, JSON.stringify(seeded.body));
    assert.equal(
      (
        await call(subscription, "POST", {
          initData: init(),
          action: "activate",
        })
      ).status,
      403,
    );
    await query(
      "INSERT INTO warehouses(name,address,latitude,longitude) VALUES('Центр','Москва',55.75,37.62)",
    );
    await query("INSERT INTO couriers(name,warehouse_id) VALUES('Курьер',1)");
    const sub = await createPayment(101, "subscription", "subscription-key-1");
    assert.equal(
      (await call(subscription, "POST", { initData: init() })).body.active,
      false,
    );
    const subRemote = [...remote.values()][0];
    subRemote.status = "succeeded";
    subRemote.paid = true;
    await reconcilePayment(sub.paymentId, 101);
    const expires = (await call(subscription, "POST", { initData: init() }))
      .body.expiresAt;
    await reconcilePayment(sub.paymentId, 101);
    assert.equal(
      (await call(subscription, "POST", { initData: init() })).body.expiresAt,
      expires,
    );
    await assert.rejects(() => reconcilePayment(sub.paymentId, 202));
    const draft = {
      initData: init(),
      requestKey: "order-key-00001",
      items: [{ productId: 1, quantity: 0.5, price: 1 }],
      delivery: {
        name: "Покупатель",
        phone: "+79991234567",
        addressId: "11111111-1111-1111-1111-111111111111",
      },
    };
    failOrderSave = true;
    const failed = await call(orders, "POST", draft);
    failOrderSave = false;
    assert.equal(failed.status, 503);
    assert.equal(failed.body.ok, false);
    assert.equal(
      (await query("SELECT COUNT(*) AS count FROM orders")).rows[0].count,
      0,
    );
    const created = await call(orders, "POST", draft);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const order = created.body.order;
    assert.equal(order.total, 94.5);
    assert.equal(order.payableTotal, 384.5);
    assert.equal(order.paymentStatus, "pending");
    assert.equal(order.status, "pending");
    const repeated = await call(orders, "POST", draft);
    assert.equal(repeated.body.order.id, order.id);
    assert.equal(
      (
        await call(orders, "POST", {
          ...draft,
          items: [{ productId: 1, quantity: 1 }],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(reviews, "POST", {
          initData: init(),
          productId: 1,
          rating: 5,
        })
      ).status,
      403,
    );
    const payment = await createPayment(
      101,
      "order",
      "payment-key-0001",
      order.id,
    );
    const paymentAgain = await createPayment(
      101,
      "order",
      "payment-key-0002",
      order.id,
    );
    assert.equal(paymentAgain.paymentId, payment.paymentId);
    const remotePayment = [...remote.values()][1];
    remotePayment.status = "succeeded";
    remotePayment.paid = true;
    forgedAmount = true;
    await assert.rejects(() => reconcilePayment(payment.paymentId, 101));
    assert.equal(
      (await call(myOrders, "POST", { initData: init() })).body.orders[0]
        .paymentStatus,
      "pending",
    );
    forgedAmount = false;
    await reconcilePayment(payment.paymentId, 101);
    await reconcilePayment(payment.paymentId, 101);
    const paid = (await call(myOrders, "POST", { initData: init() })).body
      .orders[0];
    assert.equal(paid.paymentStatus, "succeeded");
    assert.equal(paid.status, "paid");
    assert.equal(
      (await query("SELECT orders_count FROM users WHERE telegram_id=101"))
        .rows[0].orders_count,
      1,
    );
    assert.equal(
      (
        await call(reviews, "POST", {
          initData: init(),
          productId: 1,
          rating: 5,
          message: "Свежие",
        })
      ).status,
      200,
    );
    const catalog = await call(products, "GET");
    assert.equal(
      catalog.body.products.find((p: any) => p.id === 1).actual_reviews_count,
      1,
    );
    const cat = (await call(categories, "GET")).body.categories[0];
    assert.equal(
      (
        await call(
          categories,
          "PUT",
          { name: "Новое название" },
          { id: String(cat.id) },
          true,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(categories, "GET")).body.categories[0].slug,
      cat.slug,
    );
    assert.equal(
      (await query("SELECT category FROM products WHERE id=1")).rows[0]
        .category,
      cat.slug,
    );
    assert.equal(
      (await call(categories, "DELETE", {}, { id: String(cat.id) }, true))
        .status,
      409,
    );
    assert.equal(
      (await call(orders, "PUT", { status: "paid" }, { id: "1" }, true)).status,
      400,
    );
    const second = await call(orders, "POST", {
      ...draft,
      requestKey: "order-key-00002",
    });
    const next = await createPayment(
      101,
      "order",
      "payment-key-0003",
      second.body.order.id,
    );
    const nextRemote = [...remote.values()][2];
    nextRemote.status = "canceled";
    await reconcilePayment(next.paymentId, 101);
    const retry = await createPayment(
      101,
      "order",
      "payment-key-0004",
      second.body.order.id,
    );
    assert.notEqual(retry.paymentId, next.paymentId);
    await reconcilePayment(next.paymentId, 101);
    assert.equal(
      (await query("SELECT payment_status FROM orders WHERE id=2")).rows[0]
        .payment_status,
      "pending",
    );
    assert.equal(
      (await call(orders, "PUT", { status: "shipped" }, { id: "2" }, true))
        .status,
      400,
    );
    const retryRemote = [...remote.values()][3];
    retryRemote.status = "succeeded";
    retryRemote.paid = true;
    await reconcilePayment(retry.paymentId, 101);
    await reconcilePayment(next.paymentId, 101);
    assert.equal(
      (await query("SELECT payment_status FROM orders WHERE id=2")).rows[0]
        .payment_status,
      "succeeded",
    );
  } finally {
    globalThis.fetch = originalFetch;
    (pool as any).connect = originalConnect;
    await db.close();
    await pool.end();
  }
});
