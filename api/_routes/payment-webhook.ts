import { clientAddress, limitRequest } from "../_security.js";
import { ShopError } from "../_commerce.js";
import { paymentConfiguration } from "../_payment-config.js";
import { tbankToken } from "../_payment-provider.js";
import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_db.js";
import { ensureCommerceSchema } from "../_schema.js";
import { reconcilePayment } from "../_payments.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { event, object, PaymentId } = req.body || {};
  const providerId =
    typeof PaymentId === "string" || typeof PaymentId === "number"
      ? String(PaymentId)
      : object?.id;
  const providerName = PaymentId !== undefined ? "tbank" : "yookassa";
  if (
    (providerName === "yookassa" &&
      !["payment.succeeded", "payment.canceled"].includes(event)) ||
    typeof providerId !== "string"
  )
    return res.status(400).end();
  try {
    await ensureCommerceSchema();
    await limitRequest("payment-webhook", clientAddress(req), 120);
    if (providerName === "tbank") {
      const config = await paymentConfiguration("tbank");
      const supplied = req.body?.Token;
      const expected = tbankToken(req.body, config.credentials.password);
      if (
        !config.configured ||
        typeof supplied !== "string" ||
        !/^[a-f0-9]{64}$/i.test(supplied) ||
        !crypto.timingSafeEqual(
          Buffer.from(supplied, "hex"),
          Buffer.from(expected, "hex"),
        )
      )
        return res.status(403).json({ ok: false });
    }
    const rows =
      await sql`SELECT id FROM payments WHERE provider_id=${providerId} AND provider_name=${providerName}`;
    if (!rows.rows[0])
      return providerName === "tbank"
        ? res.status(200).send("OK")
        : res.status(200).json({ ok: true });
    // Never trust notification contents: retrieve the authenticated payment from YooKassa.
    await reconcilePayment(String(rows.rows[0].id));
    return providerName === "tbank"
      ? res.status(200).send("OK")
      : res.status(200).json({ ok: true });
  } catch (e) {
    return res
      .status(e instanceof ShopError ? e.status : 503)
      .json({ ok: false });
  }
}
