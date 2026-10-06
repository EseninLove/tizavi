import crypto from "node:crypto";
import { pool, sql } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { paymentMatches, ShopError } from "./_commerce.js";
import { SUBSCRIPTION_DAYS, SUBSCRIPTION_PRICE_RUB } from "./_subscription.js";

export { paymentsConfigured } from "./_payment-config.js";
import { paymentsConfigured, paymentConfiguration } from "./_payment-config.js";
import { providerCreate, providerStatus } from "./_payment-provider.js";
export async function createPayment(
  userId: number,
  kind: string,
  requestKey: string,
  orderNumber?: string,
) {
  if (!(await paymentsConfigured()))
    throw new ShopError("Оплата пока не подключена", 503);
  if (
    !["order", "subscription"].includes(kind) ||
    !/^[a-zA-Z0-9-]{8,100}$/.test(requestKey)
  )
    throw new ShopError("Некорректный запрос оплаты");
  await ensureCommerceSchema();
  const config = await paymentConfiguration();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [userId]);
    let order: Record<string, any> | undefined;
    if (kind === "order") {
      order = (
        await client.query(
          "SELECT * FROM orders WHERE order_number=$1 AND telegram_user_id=$2 FOR UPDATE",
          [orderNumber, userId],
        )
      ).rows[0];
      if (!order) throw new ShopError("Заказ не найден", 404);
      if (order.status === "cancelled") throw new ShopError("Заказ отменён");
      if (order.payment_status === "succeeded")
        throw new ShopError("Заказ уже оплачен");
      if (order.payment_status === "unverified")
        throw new ShopError("Оплата старого заказа требует проверки поддержки");
      const products = (
        await client.query(
          "SELECT id, in_stock FROM products WHERE id = ANY($1::int[])",
          [order.items.map((i: any) => Number(i.product.id))],
        )
      ).rows;
      if (
        order.items.some(
          (i: any) =>
            !products.find(
              (p: any) => p.id === Number(i.product.id) && p.in_stock,
            ),
        )
      )
        throw new ShopError(
          "Часть товаров уже недоступна. Соберите новый заказ.",
        );
    }
    let intent = (
      await client.query(
        kind === "order"
          ? "SELECT * FROM payments WHERE order_id=$1 AND status!='canceled' FOR UPDATE"
          : "SELECT * FROM payments WHERE telegram_id=$1 AND request_key=$2 FOR UPDATE",
        kind === "order" ? [order!.id] : [userId, requestKey],
      )
    ).rows[0];
    if (
      intent &&
      (intent.kind !== kind || Number(intent.telegram_id) !== userId)
    )
      throw new ShopError("Некорректная оплата");
    if (!intent) {
      const amount =
        kind === "order"
          ? Math.round(Number(order!.payable_total) * 100)
          : Math.round(SUBSCRIPTION_PRICE_RUB * 100);
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new ShopError("Некорректная сумма");
      intent = (
        await client.query(
          "INSERT INTO payments(id,telegram_id,kind,order_id,request_key,amount_minor,subscription_days,provider_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            crypto.randomUUID(),
            userId,
            kind,
            order?.id || null,
            requestKey,
            amount,
            kind === "subscription" ? SUBSCRIPTION_DAYS : null,
            config.name,
          ],
        )
      ).rows[0];
    }
    if (order && intent.status === "pending")
      await client.query(
        "UPDATE orders SET payment_status='pending',updated_at=NOW() WHERE id=$1",
        [order.id],
      );
    // Persist the idempotency key before making a remote request, so retries reuse it after a timeout.
    await client.query("COMMIT");
    if (intent.status === "canceled")
      throw new ShopError(
        "Этот платёж отменён. Для заказа создайте новую попытку оплаты.",
        409,
      );
    await client.query("BEGIN");
    intent = (
      await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
        intent.id,
      ])
    ).rows[0];
    if (!intent.provider_id) {
      const payment = await providerCreate(
        intent,
        kind === "order"
          ? `Tizavi: заказ ${orderNumber}`
          : `Tizavi: подписка на ${intent.subscription_days} дней`,
      );
      if (
        !payment.providerId ||
        (payment.url && !payment.url.startsWith("https://"))
      )
        throw new ShopError("Не удалось открыть страницу оплаты", 502);
      await client.query(
        "UPDATE payments SET provider_id=$2,confirmation_url=$3 WHERE id=$1",
        [intent.id, payment.providerId, payment.url || null],
      );
      intent.provider_id = payment.providerId;
      intent.confirmation_url = payment.url;
    }
    await client.query("COMMIT");
    return {
      paymentId: intent.id,
      confirmationUrl: intent.confirmation_url,
      status: intent.status,
      amount: Number(intent.amount_minor) / 100,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function reconcilePayment(id: string, userId?: number) {
  if (!/^[\da-f-]{36}$/i.test(id))
    throw new ShopError("Некорректный идентификатор платежа");
  await ensureCommerceSchema();
  const result = await sql`SELECT * FROM payments WHERE id=${id}`;
  const intent = result.rows[0] as Record<string, any> | undefined;
  if (
    !intent ||
    (userId !== undefined && Number(intent.telegram_id) !== userId)
  )
    throw new ShopError("Платёж не найден", 404);
  if (!intent.provider_id)
    return { status: "pending", kind: intent.kind, orderNumber: null };
  const payment = await providerStatus(intent);
  if (!paymentMatches(payment, intent))
    throw new ShopError("Платёж не прошёл проверку", 502);
  // Test transactions can never unlock a production subscription or fulfil a real order.
  if (payment.test === true && !payment.allowTest)
    throw new ShopError("Тестовые платежи отключены", 409);
  const status =
    payment.status === "succeeded" && payment.paid === true
      ? "succeeded"
      : payment.status === "canceled"
        ? "canceled"
        : "pending";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serializes extension of a subscription across different successful payment IDs.
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      Number(intent.telegram_id),
    ]);
    const locked = (
      await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    let orderNumber: string | null = null;
    if (locked.order_id) {
      const order = (
        await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
          locked.order_id,
        ])
      ).rows[0];
      orderNumber = order.order_number;
      if (status === "succeeded" && !locked.applied_at) {
        if (
          Math.round(Number(order.payable_total) * 100) !==
          Number(locked.amount_minor)
        )
          throw new ShopError("Сумма заказа не совпала с оплатой", 409);
        await client.query(
          "UPDATE orders SET payment_status='succeeded', status=CASE WHEN status='pending' THEN 'paid' ELSE status END, updated_at=NOW() WHERE id=$1",
          [order.id],
        );
        await client.query(
          "UPDATE users SET orders_count=COALESCE(orders_count,0)+1,total_spent=COALESCE(total_spent,0)+$1 WHERE telegram_id=$2",
          [Number(order.total), intent.telegram_id],
        );
      } else if (status === "canceled" && !locked.applied_at) {
        await client.query(
          `UPDATE orders SET payment_status='canceled', updated_at=NOW()
           WHERE id=$1 AND payment_status!='succeeded'
           AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id=$1 AND id!=$2 AND status!='canceled')`,
          [order.id, id],
        );
      }
    } else if (status === "succeeded" && !locked.applied_at) {
      await client.query(
        `INSERT INTO subscriptions(telegram_id,expires_at,payment_method) VALUES($1,NOW()+$2*INTERVAL '1 day','aggregator') ON CONFLICT(telegram_id) DO UPDATE SET expires_at=GREATEST(subscriptions.expires_at,NOW())+$2*INTERVAL '1 day',payment_method='aggregator',updated_at=NOW()`,
        [intent.telegram_id, Number(locked.subscription_days)],
      );
    }
    if (!locked.applied_at)
      await client.query(
        "UPDATE payments SET status=$2,applied_at=CASE WHEN $2='succeeded' THEN NOW() ELSE NULL END WHERE id=$1",
        [id, status],
      );
    await client.query("COMMIT");
    return {
      status: locked.applied_at ? "succeeded" : status,
      kind: intent.kind,
      orderNumber,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
