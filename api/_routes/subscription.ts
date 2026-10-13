import { requireCustomer } from "../_customer-auth.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSubscription,
  SUBSCRIPTION_DAYS,
  SUBSCRIPTION_PRICE_RUB,
} from "../_subscription.js";
import { createPayment, paymentsConfigured } from "../_payments.js";
import { ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { action, requestKey } = req.body || {};
  if (action === "activate")
    return res.status(403).json({
      ok: false,
      error: "Подписка активируется только после подтверждения оплаты сервисом",
    });
  try {
    const customer = await requireCustomer(req),
      userId = Number(customer.id);
    if (action === "invoice")
      return res.json({
        ok: true,
        ...(await createPayment(userId, "subscription", requestKey)),
      });
    return res.json({
      ok: true,
      ...(await getSubscription(userId)),
      priceRub: SUBSCRIPTION_PRICE_RUB,
      days: SUBSCRIPTION_DAYS,
      paymentsConfigured: await paymentsConfigured(),
    });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось проверить подписку",
    });
  }
}
