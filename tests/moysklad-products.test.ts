import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchProductImage,
  mapRemoteProduct,
  metaId,
  productRequest,
  productUnit,
} from "../api/_moysklad-products";
import { calculateItems } from "../api/_commerce";
const id = "11111111-1111-1111-1111-111111111111",
  price = "22222222-2222-2222-2222-222222222222",
  currency = "33333333-3333-3333-3333-333333333333";
const categories = new Map([[id, { slug: "stable", hidden: false }]]),
  rubles = new Set([currency]);
const row = {
  id,
  name: "Весовой товар",
  uom: { name: "г" },
  productFolder: { id },
  salePrices: [
    { value: 125, priceType: { id: price }, currency: { id: currency } },
  ],
  variantsCount: 0,
};
test("Product import converts grams and minor prices, uses free stock, requires RUB and known units/categories, and never trusts arbitrary meta URLs", () => {
  const p = mapRemoteProduct(
    row,
    price,
    rubles,
    categories,
    new Map([[id, 1500]]),
  );
  assert.equal(p.unit, "кг");
  assert.equal(p.price, 1250);
  assert.equal(p.available, 1.5);
  assert.equal(p.inStock, true);
  assert.equal(p.category, "stable");
  assert.equal(
    mapRemoteProduct(
      { ...row, salePrices: [] },
      price,
      rubles,
      categories,
      new Map([[id, 1500]]),
    ).inStock,
    false,
  );
  assert.equal(
    mapRemoteProduct(row, price, new Set(), categories, new Map([[id, 1500]]))
      .price,
    0,
  );
  assert.equal(
    mapRemoteProduct(
      { ...row, archived: true },
      price,
      rubles,
      categories,
      new Map([[id, 1500]]),
    ).hidden,
    true,
  );
  assert.ok(
    mapRemoteProduct(
      { ...row, variantsCount: 1 },
      price,
      rubles,
      categories,
      new Map(),
    ).issue,
  );
  assert.ok(
    mapRemoteProduct(
      { ...row, productFolder: null },
      price,
      rubles,
      categories,
      new Map(),
    ).issue,
  );
  assert.equal(productUnit({ name: "коробка" }), null);
  assert.equal(productUnit({ name: "мл" })?.factor, 1000);
  assert.equal(
    metaId(
      {
        meta: {
          href: "https://attacker.invalid/api/remap/1.2/entity/product/" + id,
        },
      },
      "product",
    ),
    null,
  );
  assert.equal(
    metaId(
      {
        meta: {
          href: "https://api.moysklad.ru/api/remap/1.2/entity/product/" + id,
        },
      },
      "product",
    ),
    id,
  );
  const product = {
    id: 1,
    moysklad_id: id,
    in_stock: true,
    unit: "кг",
    price: 1250,
    name: "Весовой",
    stock_available: 1.5,
    stock_synced_at: new Date(),
  };
  assert.equal(
    calculateItems([{ productId: 1, quantity: 1.5 }], [product]).subtotalMinor,
    187500,
  );
  assert.throws(
    () => calculateItems([{ productId: 1, quantity: 2 }], [product]),
    /Недостаточно/,
  );
  assert.throws(
    () =>
      calculateItems(
        [{ productId: 1, quantity: 1 }],
        [{ ...product, stock_synced_at: new Date(Date.now() - 16 * 60000) }],
      ),
    /требует обновления/,
  );
});
test("Image cache rejects arbitrary origins and non-images and never sends API credentials to the miniature host", async () => {
  let calls = 0;
  const transport = (async (url: any, opts: any) => {
    calls++;
    assert.equal(new URL(String(url)).hostname, "miniature-prod.moysklad.ru");
    assert.equal(opts.headers, undefined);
    assert.equal(opts.redirect, "error");
    return new Response(Buffer.from("89504e470d0a1a0a", "hex"));
  }) as typeof fetch;
  await assert.rejects(() =>
    fetchProductImage(
      { miniature: { downloadHref: "https://127.0.0.1/private" } },
      transport,
    ),
  );
  assert.equal(calls, 0);
  const image = await fetchProductImage(
    {
      updated: "v1",
      miniature: {
        downloadHref: `https://miniature-prod.moysklad.ru/miniature/${id}/documentminiature/${price}`,
      },
    },
    transport,
  );
  assert.equal(image?.mime, "image/png");
  assert.equal(calls, 1);
  await assert.rejects(() =>
    fetchProductImage(
      {
        miniature: {
          downloadHref: `https://miniature-prod.moysklad.ru/miniature/${id}/documentminiature/${price}`,
        },
      },
      (async () => new Response("<svg>not an image</svg>")) as typeof fetch,
    ),
  );
  const secret = "never-print-this-test-token-123";
  await assert.rejects(
    () =>
      productRequest(secret, "/entity/product?limit=1", (async () => {
        throw new Error(secret);
      }) as typeof fetch),
    (e) => !String(e).includes(secret),
  );
});
