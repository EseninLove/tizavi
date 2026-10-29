import { isStaffRole } from "../../../src/shared/staff.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "../../_helpers.js";
import { sql, pool } from "../../_db.js";
import { ShopError, positiveInteger } from "../../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await authenticateAdmin(req);
    if (!auth.authorized || auth.user?.role !== "super_admin")
      return res.status(403).json({
        ok: false,
        error: "Управление сотрудниками доступно владельцу",
      });
    if (req.method === "GET")
      return res.json({
        ok: true,
        admins: (
          await sql`SELECT id,telegram_id,name,role,created_at FROM admins ORDER BY created_at LIMIT 500`
        ).rows,
      });
    if (!["POST", "PUT", "DELETE"].includes(req.method || ""))
      return res.status(405).json({ ok: false });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(78264322)");
      let target: number;
      const name = req.body?.name ?? "";
      const role = req.body?.role ?? "admin";
      if (
        req.method !== "DELETE" &&
        (!isStaffRole(role) ||
          typeof name !== "string" ||
          name.trim().length > 100)
      )
        throw new ShopError("Проверьте имя и роль сотрудника");
      if (req.method === "POST") {
        target = positiveInteger(req.body?.telegramId, Number.MAX_SAFE_INTEGER);
        const duplicate = await client.query(
          "SELECT id FROM admins WHERE telegram_id=$1",
          [target],
        );
        if (duplicate.rows.length)
          throw new ShopError(
            "Сотрудник с таким Telegram ID уже добавлен. Измените его роль в списке.",
            409,
          );
        await client.query(
          "INSERT INTO admins(telegram_id,name,role) VALUES($1,$2,$3)",
          [target, name.trim(), role],
        );
      } else {
        const id = positiveInteger(req.query.id);
        const row = (
          await client.query(
            "SELECT telegram_id,role FROM admins WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!row) throw new ShopError("Сотрудник не найден", 404);
        if (
          row.role === "super_admin" &&
          (req.method === "DELETE" || role !== "super_admin") &&
          Number(
            (
              await client.query(
                "SELECT COUNT(*) AS count FROM admins WHERE role='super_admin'",
              )
            ).rows[0].count,
          ) <= 1
        )
          throw new ShopError(
            "Нельзя удалить или понизить последнего владельца",
            409,
          );
        target = Number(row.telegram_id);
        if (req.method === "DELETE" || role !== row.role)
          await client.query(
            "DELETE FROM admin_sessions WHERE telegram_id=$1",
            [target],
          );
        if (req.method === "PUT")
          await client.query("UPDATE admins SET name=$2,role=$3 WHERE id=$1", [
            id,
            name.trim(),
            role,
          ]);
        else await client.query("DELETE FROM admins WHERE id=$1", [id]);
      }
      await client.query(
        "INSERT INTO admin_audit(actor,action,target,result) VALUES($1,$2,$3,$4)",
        [
          auth.user.telegramId
            ? `telegram:${auth.user.telegramId}`
            : "owner-key",
          req.method === "POST"
            ? "admin_added"
            : req.method === "PUT"
              ? "admin_updated"
              : "admin_deleted",
          String(target),
          req.method === "POST" ? 201 : 200,
        ],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return res.status(req.method === "POST" ? 201 : 200).json({ ok: true });
  } catch (e) {
    return res.status(e instanceof ShopError ? e.status : 503).json({
      ok: false,
      error:
        e instanceof ShopError ? e.message : "Не удалось изменить сотрудников",
    });
  }
}
