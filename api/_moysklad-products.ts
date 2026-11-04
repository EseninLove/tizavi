import crypto from "node:crypto";
import { pool } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { decryptCredentials } from "./_payment-config.js";
import {
  MOYSKLAD_API,
  moyskladId,
  validateMoyskladToken,
} from "./_moysklad-client.js";
import { syncMoyskladCategories } from "./_moysklad-categories.js";
import { ShopError } from "./_commerce.js";

export function metaId(value: any, type: string): string | null {
  if (moyskladId(value?.id)) return value.id.toLowerCase();
  if (typeof value?.meta?.href !== "string") return null;
  try {
    const u = new URL(value.meta.href);
    const prefix =
      type === "pricetype"
        ? "/api/remap/1.2/context/companysettings/pricetype/"
        : `/api/remap/1.2/entity/${type}/`;
    const id = u.pathname.slice(prefix.length);
    return u.origin === "https://api.moysklad.ru" &&
      u.pathname.startsWith(prefix) &&
      moyskladId(id)
      ? id.toLowerCase()
      : null;
  } catch {
    return null;
  }
}
async function boundedBody(r: Response, limit: number) {
  const reader = r.body?.getReader();
  if (!reader) throw new Error("Empty response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function productRequest(
  token: string,
  path: string,
  transport: typeof fetch = fetch,
): Promise<any> {
  if (!/^\/(entity\/(product|currency)|report\/stock\/all)\?/.test(path))
    throw new ShopError("Неверный адрес каталога");
  try {
    const r = await transport(MOYSKLAD_API + path, {
      headers: {
        Authorization: `Bearer ${validateMoyskladToken(token)}`,
        Accept: "application/json;charset=utf-8",
        "Accept-Encoding": "gzip",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      await r.body?.cancel();
      throw new ShopError(
        r.status === 401 || r.status === 403
          ? "МойСклад запретил чтение товаров или остатков. Проверьте права сотрудника и тариф."
          : "Не удалось загрузить товары и остатки МоегоСклада. Повторите обновление.",
        503,
      );
    }
    return JSON.parse((await boundedBody(r, 8 * 1024 * 1024)).toString("utf8"));
  } catch (e) {
    if (e instanceof ShopError) throw e;
    throw new ShopError(
      "Не удалось получить полный каталог МоегоСклада. Предыдущие данные сохранены.",
      503,
    );
  }
}
async function list(
  token: string,
  path: string,
  transport: typeof fetch,
  deadline = Date.now() + 90000,
) {
  const rows: any[] = [];
  for (let page = 0; page < 100; page++) {
    if (Date.now() > deadline)
      throw new ShopError(
        "Каталог не успел загрузиться. Повторите обновление или уменьшите объём каталога.",
        503,
      );
    const d = await productRequest(
      token,
      `${path}&limit=100&offset=${page * 100}`,
      transport,
    );
    if (!Array.isArray(d.rows))
      throw new ShopError("Неожиданный формат каталога МоегоСклада", 503);
    rows.push(...d.rows);
    if (
      d.rows.length < 100 ||
      (Number.isSafeInteger(d.meta?.size) && rows.length >= d.meta.size)
    )
      return rows;
  }
  throw new ShopError(
    "Более 10000 позиций: требуется дополнительная настройка",
    400,
  );
}
export function productUnit(uom: any): { unit: string; factor: number } | null {
  const n = String(uom?.name || "")
    .toLowerCase()
    .trim()
    .replace(/\.$/, "");
  if (["шт", "штука", "штуки"].includes(n) || uom?.code === "796")
    return { unit: "шт", factor: 1 };
  if (["кг", "килограмм", "килограммы"].includes(n) || uom?.code === "166")
    return { unit: "кг", factor: 1 };
  if (["л", "литр", "литры"].includes(n) || uom?.code === "112")
    return { unit: "л", factor: 1 };
  if (["г", "гр", "грамм", "граммы"].includes(n) || uom?.code === "163")
    return { unit: "кг", factor: 1000 };
  if (["мл", "миллилитр", "миллилитры"].includes(n))
    return { unit: "л", factor: 1000 };
  return null;
}
export function mapRemoteProduct(
  row: any,
  priceTypeId: string,
  rubles: Set<string>,
  categories: Map<string, { slug: string; hidden: boolean }>,
  stock: Map<string, number>,
) {
  if (
    !moyskladId(row.id) ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    row.name.length > 255
  )
    throw new ShopError("Неожиданный формат товара МоегоСклада", 503);
  const id = row.id.toLowerCase();
  const unit = productUnit(row.uom);
  const category = categories.get(
    metaId(row.productFolder, "productfolder") || "",
  );
  const price = (Array.isArray(row.salePrices) ? row.salePrices : []).find(
    (p: any) => metaId(p.priceType, "pricetype") === priceTypeId,
  );
  const currencyId = metaId(price?.currency, "currency");
  const value = (Number(price?.value) * (unit?.factor || 1)) / 100;
  const validPrice =
    currencyId &&
    rubles.has(currencyId) &&
    Number.isFinite(value) &&
    Math.round(value * 100) > 0 &&
    value <= 1000000;
  const issues: string[] = [];
  if (!category) issues.push("Укажите группу товаров в МоёмСкладе");
  if (!unit) issues.push("Поддерживаются единицы шт, кг, г, л и мл");
  if (!validPrice)
    issues.push("Укажите положительную цену в рублях для выбранного типа цен");
  if (Number(row.variantsCount) > 0)
    issues.push(
      "Товар с модификациями: отдельная настройка импорта пока не поддерживается",
    );
  const available = Math.max(0, (stock.get(id) || 0) / (unit?.factor || 1));
  const hidden = row.archived === true || category?.hidden === true;
  return {
    id,
    name: row.name.trim(),
    description: String(row.description || "").slice(0, 4096),
    category: category?.slug || "",
    unit: unit?.unit || "шт",
    price: validPrice ? Math.round(value * 100) / 100 : 0,
    available: Math.floor(available * 1000) / 1000,
    hidden,
    issue: issues.join(". "),
    inStock:
      !hidden &&
      !issues.length &&
      available >= (unit?.unit === "кг" || unit?.unit === "л" ? 0.5 : 1),
    image: row.images?.rows?.[0],
  };
}
export async function fetchProductImage(
  image: any,
  transport: typeof fetch = fetch,
) {
  // Public miniature URL only; authorization is NEVER sent to a CDN or arbitrary image URL.
  const href = image?.miniature?.downloadHref;
  if (typeof href !== "string") return null;
  const u = new URL(href);
  if (
    u.origin !== "https://miniature-prod.moysklad.ru" ||
    !/^\/miniature\/[a-f0-9-]{36}\/documentminiature\/[a-f0-9-]{36}$/.test(
      u.pathname,
    ) ||
    u.search ||
    u.username ||
    u.password
  )
    throw new Error("Unsupported image origin");
  const r = await transport(u.toString(), {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    await r.body?.cancel();
    throw new Error("Image unavailable");
  }
  const content = await boundedBody(r, 2 * 1024 * 1024);
  const mime = content
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : content[0] === 255 && content[1] === 216 && content[2] === 255
      ? "image/jpeg"
      : content.subarray(0, 4).toString() === "RIFF" &&
          content.subarray(8, 12).toString() === "WEBP"
        ? "image/webp"
        : null;
  if (!mime) throw new Error("Unsupported image");
  return {
    content,
    mime,
    key: u.toString() + ":" + String(image.updated || ""),
  };
}
export async function syncMoyskladProducts(
  scheduled = false,
  transport: typeof fetch = fetch,
) {
  await ensureCommerceSchema();
  // Product and category jobs share this lock; category changes cannot race the product snapshot.
  const initial = await pool.connect();
  let enabled = false;
  try {
    const s = (
      await initial.query(
        "SELECT products_enabled FROM moysklad_settings WHERE id=1",
      )
    ).rows[0];
    enabled = s.products_enabled;
  } finally {
    initial.release();
  }
  if (scheduled && !enabled) return { skipped: true };
  await syncMoyskladCategories(false, true);
  const c = await pool.connect();
  let locked = false,
    tx = false;
  try {
    locked = (await c.query("SELECT pg_try_advisory_lock(78264322) AS locked"))
      .rows[0].locked;
    if (!locked)
      throw new ShopError(
        "Синхронизация уже выполняется. Подождите немного.",
        409,
      );
    const s = (await c.query("SELECT * FROM moysklad_settings WHERE id=1"))
      .rows[0];
    if (scheduled && !s.products_enabled) return { skipped: true };
    if (
      !s.token_encrypted ||
      !moyskladId(s.store_id) ||
      !moyskladId(s.price_type_id)
    )
      throw new ShopError(
        "Сначала выберите склад и тип цен в настройках МоегоСклада",
      );
    if (!s.categories_enabled)
      throw new ShopError("Сначала включите синхронизацию категорий");
    const token = validateMoyskladToken(
      decryptCredentials(s.token_encrypted).accessToken,
    );
    const deadline = Date.now() + 90000;
    const currencies = await list(
      token,
      "/entity/currency?",
      transport,
      deadline,
    );
    const rubles = new Set<string>(
      currencies
        .filter(
          (r) =>
            String(r.code) === "643" && r.isoCode === "RUB" && moyskladId(r.id),
        )
        .map((r) => r.id.toLowerCase()),
    );
    const rows = await list(
      token,
      "/entity/product?expand=uom,images",
      transport,
      deadline,
    );
    const stockRows = await list(
      token,
      "/report/stock/all?groupBy=product&filter=" +
        encodeURIComponent(
          `store=${MOYSKLAD_API}/entity/store/${s.store_id};stockMode=all`,
        ),
      transport,
      deadline,
    );
    const stock = new Map<string, number>();
    for (const r of stockRows) {
      const id = metaId(r, "product");
      if (!id || !Number.isFinite(r.stock) || !Number.isFinite(r.reserve))
        throw new ShopError("Неожиданный формат остатков МоегоСклада", 503);
      if (stock.has(id))
        throw new ShopError("Повторяющиеся строки остатков МоегоСклада", 503);
      stock.set(id, Math.max(0, r.stock - r.reserve));
    }
    const categories = new Map<string, { slug: string; hidden: boolean }>(
      (
        await c.query(
          "SELECT slug,moysklad_id,moysklad_hidden FROM categories WHERE moysklad_id IS NOT NULL",
        )
      ).rows.map((r) => [
        r.moysklad_id,
        { slug: r.slug, hidden: r.moysklad_hidden },
      ]),
    );
    const mapped = rows.map((r) =>
      mapRemoteProduct(r, s.price_type_id, rubles, categories, stock),
    );
    if (new Set(mapped.map((r) => r.id)).size !== mapped.length)
      throw new ShopError(
        "Каталог изменился во время чтения. Повторите обновление",
        409,
      );
    const previous = (
      await c.query(
        "SELECT p.id,p.moysklad_id,i.remote_key FROM products p LEFT JOIN moysklad_product_images i ON i.product_id=p.id WHERE p.moysklad_id IS NOT NULL",
      )
    ).rows;
    const images = new Map<
      string,
      Awaited<ReturnType<typeof fetchProductImage>>
    >();
    let imageErrors = 0;
    let photoBytes = 0;
    for (const p of mapped) {
      if (Date.now() > deadline)
        throw new ShopError(
          "Фотографии не успели загрузиться. Повторите обновление.",
          503,
        );
      if (!p.image) {
        images.set(p.id, null);
        continue;
      }
      const old = previous.find((r) => r.moysklad_id === p.id);
      const key =
        String(p.image.miniature?.downloadHref) +
        ":" +
        String(p.image.updated || "");
      if (old?.remote_key === key) continue;
      if (photoBytes >= 16 * 1024 * 1024) {
        imageErrors++;
        continue;
      }
      try {
        const photo = await fetchProductImage(p.image, transport);
        if (photo) {
          images.set(p.id, photo);
          photoBytes += photo.content.length;
        } else imageErrors++;
      } catch {
        imageErrors++;
      }
    }
    await c.query("BEGIN");
    tx = true;
    const fresh = (
      await c.query("SELECT * FROM moysklad_settings WHERE id=1 FOR UPDATE")
    ).rows[0];
    if (
      fresh.token_encrypted !== s.token_encrypted ||
      fresh.store_id !== s.store_id ||
      fresh.price_type_id !== s.price_type_id
    )
      throw new ShopError(
        "Настройки подключения изменились. Повторите синхронизацию.",
        409,
      );
    if (scheduled && !fresh.products_enabled) {
      await c.query("ROLLBACK");
      tx = false;
      return { skipped: true };
    }
    await c.query(
      "UPDATE products SET moysklad_hidden=TRUE,in_stock=FALSE,stock_available=0 WHERE moysklad_id IS NOT NULL AND NOT(moysklad_id=ANY($1::uuid[]))",
      [mapped.map((r) => r.id)],
    );
    let created = 0;
    for (const p of mapped) {
      let existing = previous.find((r) => r.moysklad_id === p.id);
      if (!existing) {
        const result = await c.query(
          "INSERT INTO products(name,category,price,rating,reviews_count,in_stock,moysklad_id) VALUES($1,$2,$3,0,0,FALSE,$4) RETURNING id",
          [p.name, p.category, p.price, p.id],
        );
        existing = { id: result.rows[0].id };
        created++;
      }
      await c.query(
        "UPDATE products SET name=$1,description=$2,category=$3,price=$4,old_price=CASE WHEN old_price>$4 THEN old_price ELSE NULL END,unit=$5,weight=NULL,in_stock=$6,moysklad_hidden=$7,moysklad_issue=$8,stock_available=$9,stock_synced_at=NOW(),updated_at=NOW() WHERE id=$10",
        [
          p.name,
          p.description,
          p.category,
          p.price,
          p.unit,
          p.inStock,
          p.hidden,
          p.issue || null,
          p.available,
          existing.id,
        ],
      );
      if (images.has(p.id)) {
        const photo = images.get(p.id);
        if (photo) {
          await c.query(
            "INSERT INTO moysklad_product_images(product_id,remote_key,content,content_type) VALUES($1,$2,$3,$4) ON CONFLICT(product_id) DO UPDATE SET remote_key=EXCLUDED.remote_key,content=EXCLUDED.content,content_type=EXCLUDED.content_type,updated_at=NOW()",
            [existing.id, photo.key, photo.content, photo.mime],
          );
          await c.query("UPDATE products SET image=$1 WHERE id=$2", [
            `/api/product-image?id=${existing.id}&v=${crypto.createHash("sha256").update(photo.key).digest("hex").slice(0, 16)}`,
            existing.id,
          ]);
        } else {
          await c.query(
            "DELETE FROM moysklad_product_images WHERE product_id=$1",
            [existing.id],
          );
          await c.query("UPDATE products SET image='' WHERE id=$1", [
            existing.id,
          ]);
        }
      }
    }
    const summary = {
      total: mapped.length,
      created,
      unavailable: mapped.filter((p) => !p.inStock).length,
      issues: mapped
        .filter((p) => p.issue)
        .slice(0, 20)
        .map((p) => ({ name: p.name, error: p.issue })),
      imageErrors,
    };
    await c.query(
      "UPDATE moysklad_settings SET products_enabled=TRUE,products_synced_at=NOW(),products_error=NULL,products_summary=$1::jsonb,catalog_count=$2,catalog_preview=$3::jsonb WHERE id=1",
      [
        JSON.stringify(summary),
        mapped.length,
        JSON.stringify(
          mapped
            .slice(0, 5)
            .map((p) => ({ id: p.id, name: p.name, type: "product" })),
        ),
      ],
    );
    await c.query("COMMIT");
    tx = false;
    return summary;
  } catch (e) {
    if (tx) await c.query("ROLLBACK");
    if (locked)
      await c.query(
        "UPDATE moysklad_settings SET products_error=$1 WHERE id=1",
        [
          e instanceof ShopError
            ? e.message
            : "Не удалось синхронизировать товары",
        ],
      );
    throw e;
  } finally {
    try {
      if (locked) await c.query("SELECT pg_advisory_unlock(78264322)");
    } finally {
      c.release();
    }
  }
}
