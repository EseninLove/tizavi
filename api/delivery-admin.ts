import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "./_helpers.js";
import { sql } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { ShopError, positiveInteger } from "./_commerce.js";
function number(v: unknown, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new ShopError("Проверьте числовые поля");
  return n;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await authenticateAdmin(req)).authorized)
    return res.status(401).json({ ok: false, error: "Нет доступа" });
  try {
    await ensureCommerceSchema();
    if (req.method === "POST") {
      const b = req.body || {};
      if (b.kind === "warehouse") {
        if (!b.name?.trim() || !b.address?.trim())
          throw new ShopError("Укажите название и адрес склада");
        const values = {
          name: b.name.trim().slice(0, 100),
          address: b.address.trim().slice(0, 300),
          lat: number(b.latitude, 54, 57),
          lon: number(b.longitude, 35, 41),
          radius: number(b.radius_km, 1, 150),
          prep: number(b.preparation_minutes, 5, 240),
          open: number(b.open_hour, 0, 23),
          close: number(b.close_hour, 1, 24),
        };
        if (
          !Number.isInteger(values.open) ||
          !Number.isInteger(values.close) ||
          values.open >= values.close
        )
          throw new ShopError("Закрытие должно быть позже открытия");
        if (b.id)
          await sql`UPDATE warehouses SET name=${values.name},address=${values.address},latitude=${values.lat},longitude=${values.lon},radius_km=${values.radius},preparation_minutes=${values.prep},open_hour=${values.open},close_hour=${values.close},active=${b.active !== false} WHERE id=${positiveInteger(b.id)}`;
        else
          await sql`INSERT INTO warehouses(name,address,latitude,longitude,radius_km,preparation_minutes,open_hour,close_hour,active) VALUES(${values.name},${values.address},${values.lat},${values.lon},${values.radius},${values.prep},${values.open},${values.close},${b.active !== false})`;
      } else if (b.kind === "courier") {
        if (!b.name?.trim()) throw new ShopError("Укажите имя курьера");
        const warehouse = positiveInteger(b.warehouse_id);
        if (b.id)
          await sql`UPDATE couriers SET name=${b.name.trim().slice(0, 100)},phone=${String(b.phone || "").slice(0, 30)},warehouse_id=${warehouse},active=${b.active !== false} WHERE id=${positiveInteger(b.id)}`;
        else
          await sql`INSERT INTO couriers(name,phone,warehouse_id,active) VALUES(${b.name.trim().slice(0, 100)},${String(b.phone || "").slice(0, 30)},${warehouse},${b.active !== false})`;
      } else if (b.kind === "settings") {
        await sql`UPDATE delivery_settings SET base_fee=${number(b.base_fee, 0, 10000)},per_km=${number(b.per_km, 0, 1000)},free_from=${number(b.free_from, 1, 1000000)},speed_kmh=${number(b.speed_kmh, 5, 100)},road_factor=${number(b.road_factor, 1, 3)} WHERE id=1`;
      } else throw new ShopError("Неизвестная операция");
    } else if (req.method !== "GET") return res.status(405).json({ ok: false });
    const [warehouses, couriers, settings] = await Promise.all([
      sql`SELECT * FROM warehouses ORDER BY id`,
      sql`SELECT * FROM couriers ORDER BY id`,
      sql`SELECT * FROM delivery_settings WHERE id=1`,
    ]);
    return res.json({
      ok: true,
      warehouses: warehouses.rows,
      couriers: couriers.rows,
      settings: settings.rows[0],
      geocodingConfigured: !!process.env.DADATA_TOKEN,
    });
  } catch (error) {
    return res
      .status(error instanceof ShopError ? error.status : 503)
      .json({
        ok: false,
        error:
          error instanceof ShopError
            ? error.message
            : "Не удалось сохранить настройки доставки",
      });
  }
}
