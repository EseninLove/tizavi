import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateInitData } from "../_helpers.js";
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
  const { initData, action, kind, requestKey, orderNumber, paymentId } =
    req.body || {};
  const auth = validateInitData(initData || "");
  if (!auth.valid || !auth.userId)
    return res
      .status(401)
      .json({ ok: false, error: "Откройте магазин в Telegram" });
  try {
    const data =
      action === "status"
        ? await reconcilePayment(String(paymentId), auth.userId)
        : await createPayment(auth.userId, kind, requestKey, orderNumber);
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
