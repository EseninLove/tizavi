import type { VercelRequest, VercelResponse } from "@vercel/node";
import admins from "./_routes/admins/index.js";
import adminAuth from "./_routes/admin-auth.js";
import categories from "./_routes/categories/index.js";
import createInvoice from "./_routes/create-invoice.js";
import dashboard from "./_routes/dashboard.js";
import delivery from "./_routes/delivery.js";
import deliveryAdmin from "./_routes/delivery-admin.js";
import myOrders from "./_routes/my-orders.js";
import orders from "./_routes/orders/index.js";
import paymentSettings from "./_routes/payment-settings.js";
import paymentWebhook from "./_routes/payment-webhook.js";
import payments from "./_routes/payments.js";
import products from "./_routes/products/index.js";
import reviews from "./_routes/reviews.js";
import seed from "./_routes/seed.js";
import subscription from "./_routes/subscription.js";
import support from "./_routes/support.js";
import users from "./_routes/users/index.js";

const routes: Record<
  string,
  (req: VercelRequest, res: VercelResponse) => unknown
> = {
  admins,
  "admin-auth": adminAuth,
  categories,
  "create-invoice": createInvoice,
  dashboard,
  delivery,
  "delivery-admin": deliveryAdmin,
  "my-orders": myOrders,
  orders,
  "payment-settings": paymentSettings,
  "payment-webhook": paymentWebhook,
  payments,
  products,
  reviews,
  seed,
  subscription,
  support,
  users,
};

// One deployable function keeps all existing public API addresses within hosting limits.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route =
    typeof req.query.route === "string"
      ? req.query.route.replace(/\/$/, "")
      : "";
  if (!Object.prototype.hasOwnProperty.call(routes, route))
    return res.status(404).json({ ok: false, error: "Раздел не найден" });
  try {
    return await routes[route](req, res);
  } catch {
    return res
      .status(503)
      .json({
        ok: false,
        error: "Сервис временно недоступен. Повторите попытку.",
      });
  }
}
