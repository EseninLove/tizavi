import type { VercelRequest, VercelResponse } from "@vercel/node";
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res
    .status(410)
    .json({
      ok: false,
      error:
        "Используйте серверное создание заказа и /api/payments. Оплата по переданной покупателем сумме отключена.",
    });
}
