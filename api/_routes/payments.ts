import { requireCustomer } from "../_customer-auth.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createPayment,
  paymentsConfigured,
  reconcilePayment,
} from "../_payments.js";
import { ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET")
    return res.json({ ok: true, configured: await paymentsConfigured() });
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { action, kind, requestKey, orderNumber, paymentId } = req.body || {};
  try {
    const customer = await requireCustomer(req),
      userId = Number(customer.id);
    const data =
      action === "status"
        ? await reconcilePayment(String(paymentId), userId)
        : await createPayment(userId, kind, requestKey, orderNumber);
    return res.json({ ok: true, ...data });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось обработать оплату. Повторите попытку.",
    });
  }
}
