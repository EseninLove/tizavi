import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "../_helpers.js";
import { createAdminSession, removeAdminSession } from "../_admin-session.js";
import {
  authenticateCustomer,
  sessionToken,
  digest,
} from "../_customer-auth.js";
import { staffForAccount } from "../_staff-account.js";
import {
  clientAddress,
  limitRequest,
  sameOrigin,
  validAdminKey,
  writeAdminAudit,
} from "../_security.js";
import { ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const auth = await authenticateAdmin(req);
      return res.json({ ok: true, user: auth.user || null });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    sameOrigin(req);
    const { action, adminKey } = req.body || {};
    if (action === "logout") {
      const auth = await authenticateAdmin(req);
      await removeAdminSession(req, res);
      if (auth.user)
        await writeAdminAudit(
          auth.user.userId ? `account:${auth.user.userId}` : "owner-key",
          "admin_logout",
          null,
          200,
        );
      return res.json({ ok: true });
    }
    await limitRequest("admin-login", clientAddress(req), 20, 900);
    let user:
      | {
          telegramId: number;
          role: string;
          userId?: number;
          firstName?: string;
        }
      | undefined;
    let parent: string | null = null;
    if (validAdminKey(adminKey))
      user = { telegramId: 0, role: "super_admin", firstName: "Admin" };
    else if (action === "account" || req.body?.initData) {
      const customer = await authenticateCustomer(req);
      if (customer) {
        const role = await staffForAccount(customer);
        if (role) {
          user = {
            userId: Number(customer.id),
            telegramId: Number(customer.telegram_id || 0),
            role,
          };
          if (!req.body?.initData) {
            const token = sessionToken(req);
            if (token) parent = digest(token);
          }
        }
      }
    }
    if (!user) {
      await writeAdminAudit("anonymous", "admin_login_failed", null, 401);
      return res
        .status(401)
        .json({
          ok: false,
          error:
            "Нет доступа к панели сотрудников. Войдите в свой профиль или обратитесь к владельцу.",
        });
    }
    await createAdminSession(req, res, user.userId || null, parent);
    await writeAdminAudit(
      user.userId ? `account:${user.userId}` : "owner-key",
      "admin_login",
      null,
      200,
    );
    return res.json({ ok: true, user });
  } catch (e) {
    return res
      .status(e instanceof ShopError ? e.status : 503)
      .json({
        ok: false,
        error:
          e instanceof ShopError
            ? e.message
            : "Не удалось войти. Повторите попытку.",
      });
  }
}
