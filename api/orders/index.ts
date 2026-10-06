import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { sql, pool } from "../_db.js";
import {
  authenticateAdmin,
  validateInitData,
  upsertUser,
} from "../_helpers.js";
import { hasActiveSubscription } from "../_subscription.js";
import { ensureCommerceSchema } from "../_schema.js";
import {
  calculateItems,
  canFulfil,
  mapOrder,
  positiveInteger,
  ShopError,
} from "../_commerce.js";
import { quoteAddress } from "../_delivery.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "POST") {
      const { initData, items, delivery, requestKey } = req.body || {};
      const { valid, userId } = validateInitData(initData || "");
      if (!valid || !userId)
        return res
          .status(401)
          .json({ ok: false, error: "Откройте магазин в Telegram" });
      if (!(await hasActiveSubscription(userId)))
        return res
          .status(403)
          .json({
            ok: false,
            error: "Для заказа нужна активная подписка",
            code: "SUBSCRIPTION_REQUIRED",
          });
      if (!/^[a-zA-Z0-9-]{8,100}$/.test(requestKey || ""))
        throw new ShopError("Некорректный запрос");
      if (
        !delivery?.name?.trim() ||
        !/^\+?[\d\s()-]{10,25}$/.test(delivery?.phone || "")
      )
        throw new ShopError("Укажите имя и корректный телефон");
      if (
        delivery.name.length > 100 ||
        String(delivery.comment || "").length > 2000
      )
        throw new ShopError("Слишком длинные контактные данные");
      await ensureCommerceSchema();
      await upsertUser(initData, userId);
      const fingerprint = crypto
        .createHash("sha256")
        .update(JSON.stringify({ items, delivery }))
        .digest("hex");
      const existing = (
        await sql`SELECT * FROM orders WHERE telegram_user_id=${userId} AND request_key=${requestKey}`
      ).rows[0];
      if (existing) {
        if (existing.request_fingerprint !== fingerprint)
          throw new ShopError(
            "Состав заказа изменился. Повторите оформление.",
            409,
          );
        return res.json({ ok: true, order: mapOrder(existing) });
      }
      if (!Array.isArray(items)) throw new ShopError("Некорректная корзина");
      const ids = items.map((i) => positiveInteger(i.productId));
      const products = (
        await sql`SELECT * FROM products WHERE id=ANY(${ids}::int[])`
      ).rows;
      const priced = calculateItems(items, products);
      const quote = await quoteAddress(
        delivery.addressId,
        priced.subtotalMinor,
      );
      const verifiedDelivery = {
        name: delivery.name.trim(),
        phone: delivery.phone.trim(),
        city: quote.city,
        address: quote.address,
        addressId: quote.addressId,
        comment: String(delivery.comment || "").trim(),
        deliveryType: "courier",
        warehouseId: quote.warehouseId,
        estimated: true,
        earliestAt: quote.earliestAt,
        latestAt: quote.latestAt,
      };
      const feeMinor = Math.round(quote.fee * 100);
      const result =
        await sql`INSERT INTO orders(order_number,items,total,delivery_fee,payable_total,delivery,payment_method,status,payment_status,telegram_user_id,customer_name,customer_phone,request_key,request_fingerprint) VALUES(${"ORD-" + crypto.randomUUID().slice(0, 8).toUpperCase()},${JSON.stringify(priced.items)}::jsonb,${priced.subtotalMinor / 100},${feeMinor / 100},${(priced.subtotalMinor + feeMinor) / 100},${JSON.stringify(verifiedDelivery)}::jsonb,'aggregator','pending','pending',${userId},${verifiedDelivery.name},${verifiedDelivery.phone},${requestKey},${fingerprint}) ON CONFLICT(telegram_user_id,request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING *`;
      if (result.rows[0].request_fingerprint !== fingerprint)
        throw new ShopError("Состав заказа изменился", 409);
      return res
        .status(201)
        .json({ ok: true, order: mapOrder(result.rows[0]) });
    }
    if (!(await authenticateAdmin(req)).authorized)
      return res.status(401).json({ ok: false, error: "Нет доступа" });
    await ensureCommerceSchema();
    if (req.method === "GET") {
      const status =
        typeof req.query.status === "string" ? req.query.status : null;
      const result =
        status && status !== "all"
          ? await sql`SELECT * FROM orders WHERE status=${status} ORDER BY created_at DESC`
          : await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return res.json({ ok: true, orders: result.rows });
    }
    if (req.method === "PUT") {
      const id = positiveInteger(req.query.id),
        status = req.body?.status;
      if (!["shipped", "delivered", "cancelled"].includes(status))
        throw new ShopError(
          "Оплата подтверждается только агрегатором. Выберите статус доставки или отмену.",
        );
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const order = (
          await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
            id,
          ])
        ).rows[0];
        if (!order) throw new ShopError("Заказ не найден", 404);
        if (
          ["shipped", "delivered"].includes(status) &&
          !canFulfil(order.status, order.payment_status)
        )
          throw new ShopError(
            "Нельзя отправить неоплаченный или отменённый заказ",
          );
        if (status === "delivered" && order.status !== "shipped")
          throw new ShopError("Сначала передайте заказ курьеру");
        if (order.status === "delivered" || order.status === "cancelled")
          throw new ShopError("Этот заказ уже завершён");
        await client.query(
          "UPDATE orders SET status=$2,updated_at=NOW() WHERE id=$1",
          [id, status],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return res.json({ ok: true });
    }
    return res.status(405).json({ ok: false });
  } catch (error) {
    return res
      .status(error instanceof ShopError ? error.status : 503)
      .json({
        ok: false,
        error:
          error instanceof ShopError
            ? error.message
            : "Не удалось сохранить заказ. Корзина сохранена.",
      });
  }
}
