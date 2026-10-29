import { clientAddress, limitRequest } from "../_security.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { quoteAddress, suggestAddresses } from "../_delivery.js";
import { ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  try {
    await limitRequest("delivery", clientAddress(req), 40);
    const { action, query, addressId } = req.body || {};
    // Preview does not trust basket totals; the final tariff is recalculated with server product prices.
    if (action === "suggest")
      return res.json({ ok: true, suggestions: await suggestAddresses(query) });
    return res.json({ ok: true, quote: await quoteAddress(addressId, 0) });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось рассчитать доставку",
    });
  }
}
