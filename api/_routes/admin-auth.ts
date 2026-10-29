import { isStaffRole } from "../../src/shared/staff.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, validateInitData, sql } from "../_helpers.js";
import { createAdminSession, removeAdminSession } from "../_admin-session.js";
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
    const { action, adminKey, initData } = req.body || {};
    if (action === "logout") {
      const auth = await authenticateAdmin(req);
      await removeAdminSession(req, res);
      if (auth.user)
        await writeAdminAudit(
          auth.user.telegramId
            ? `telegram:${auth.user.telegramId}`
            : "owner-key",
          "admin_logout",
          null,
          200,
        );
      return res.json({ ok: true });
    }
    await limitRequest("admin-login", clientAddress(req), 20, 900);
    let user:
      { telegramId: number; role: string; firstName?: string } | undefined;
    if (validAdminKey(adminKey))
      user = { telegramId: 0, role: "super_admin", firstName: "Admin" };
    else if (typeof initData === "string" && initData.length <= 16000) {
      const auth = validateInitData(initData);
      const age =
        Math.floor(Date.now() / 1000) -
        Number(new URLSearchParams(initData).get("auth_date"));
      if (auth.valid && auth.userId && age <= 300) {
        const row = (
          await sql`SELECT role FROM admins WHERE telegram_id=${auth.userId}`
        ).rows[0];
        if (row && isStaffRole(row.role))
          user = { telegramId: auth.userId, role: String(row.role) };
      }
    }
    if (!user) {
      await writeAdminAudit("anonymous", "admin_login_failed", null, 401);
      return res.status(401).json({
        ok: false,
        error: "Неверный ключ или нет прав администратора",
      });
    }
    await createAdminSession(req, res, user.telegramId || null);
    await writeAdminAudit(
      user.telegramId ? `telegram:${user.telegramId}` : "owner-key",
      "admin_login",
      null,
      200,
    );
    return res.json({ ok: true, user });
  } catch (e) {
    return res.status(e instanceof ShopError ? e.status : 503).json({
      ok: false,
      error:
        e instanceof ShopError
          ? e.message
          : "Не удалось войти. Повторите попытку.",
    });
  }
}
