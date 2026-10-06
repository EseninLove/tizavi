import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateInitData } from "../_helpers.js";

const ADMIN_KEY = process.env.ADMIN_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { initData, adminKey } = (req.body || {}) as {
    initData?: string;
    adminKey?: string;
  };

  if (adminKey) {
    if (ADMIN_KEY && adminKey.trim() === ADMIN_KEY.trim()) {
      return res.status(200).json({
        ok: true,
        method: "key",
        user: { role: "super_admin", firstName: "Admin" },
      });
    }
    return res
      .status(401)
      .json({ ok: false, error: "Неверный ключ администратора" });
  }

  if (initData) {
    const { valid, userId } = validateInitData(initData);
    if (!valid || !userId) {
      return res
        .status(401)
        .json({ ok: false, error: "Невалидные данные Telegram" });
    }

    let isAdmin = false;
    let role = "admin";
    try {
      const { sql } = await import("../_db.js");
      const result =
        await sql`SELECT role FROM admins WHERE telegram_id = ${userId}`;
      isAdmin = (result.rowCount ?? 0) > 0;
      role = String(result.rows[0]?.role || "admin");
    } catch {
      return res.status(500).json({
        ok: false,
        error: "База данных недоступна. Проверьте переменную DB_URL.",
      });
    }

    if (!isAdmin) {
      return res
        .status(403)
        .json({ ok: false, error: "У вас нет прав администратора" });
    }

    const userParam = new URLSearchParams(initData).get("user");
    const user = userParam ? JSON.parse(userParam) : {};

    return res.status(200).json({
      ok: true,
      method: "telegram",
      user: {
        telegramId: userId,
        username: user.username,
        firstName: user.first_name,
        role,
      },
    });
  }

  return res
    .status(400)
    .json({ ok: false, error: "Не переданы данные для авторизации" });
}
