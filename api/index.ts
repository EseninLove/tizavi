import { authenticateAdmin } from "./_helpers.js";
import { clientAddress, limitRequest, writeAdminAudit } from "./_security.js";
import { ShopError } from "./_commerce.js";
import privacy from "./_routes/privacy.js";
import customerAuth from "./_routes/customer-auth.js";
import emailSettings from "./_routes/email-settings.js";
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
  "customer-auth": customerAuth,
  privacy,
  "email-settings": emailSettings,
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const adminRoutes = [
      "admins",
      "admin-auth",
      "dashboard",
      "delivery-admin",
      "email-settings",
      "payment-settings",
      "seed",
      "users",
    ];
    if (adminRoutes.includes(route) && route !== "admin-auth") {
      await limitRequest("admin-api", clientAddress(req), 180);
      if (!(await authenticateAdmin(req)).authorized)
        return res
          .status(401)
          .json({ ok: false, error: "Сессия завершена. Войдите снова." });
    }
    const administrativeMutation =
      ["POST", "PUT", "DELETE"].includes(req.method || "") &&
      ([
        "categories",
        "products",
        "delivery-admin",
        "email-settings",
        "payment-settings",
        "seed",
      ].includes(route) ||
        (["orders", "support", "reviews", "privacy"].includes(route) &&
          req.method === "PUT"));
    if (administrativeMutation) {
      const auth = await authenticateAdmin(req);
      if (auth.authorized && auth.user) {
        const actor = auth.user.telegramId
          ? `telegram:${auth.user.telegramId}`
          : "owner-key";
        const json = res.json.bind(res);
        res.json = ((data: unknown) => {
          const status = res.statusCode;
          return writeAdminAudit(
            actor,
            `${req.method}:${route}`,
            /^\d{1,16}$/.test(String(req.query.id || ""))
              ? String(req.query.id)
              : null,
            status,
          )
            .catch(() => {
              console.error("[security] admin audit write failed");
            })
            .then(() => json(data));
        }) as unknown as typeof res.json;
      }
    }
    return await routes[route](req, res);
  } catch (e) {
    return res.status(e instanceof ShopError ? e.status : 503).json({
      ok: false,
      error:
        e instanceof ShopError
          ? e.message
          : "Сервис временно недоступен. Повторите попытку.",
    });
  }
}
