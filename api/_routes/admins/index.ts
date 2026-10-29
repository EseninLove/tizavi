import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "../../_helpers.js";
import { sql, pool } from "../../_db.js";
import { ShopError, positiveInteger } from "../../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await authenticateAdmin(req);
    if (!auth.authorized || auth.user?.role !== "super_admin")
      return res
        .status(403)
        .json({
          ok: false,
          error: "Управление сотрудниками доступно владельцу",
        });
    if (req.method === "GET")
      return res.json({
        ok: true,
        admins: (
          await sql`SELECT id,telegram_id,role,created_at FROM admins ORDER BY created_at LIMIT 500`
        ).rows,
      });
    if (!["POST", "DELETE"].includes(req.method || ""))
      return res.status(405).json({ ok: false });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(78264322)");
      let target: number;
      if (req.method === "POST") {
        target = positiveInteger(req.body?.telegramId, Number.MAX_SAFE_INTEGER);
        const role = req.body?.role || "admin";
        if (!["admin", "super_admin"].includes(role))
          throw new ShopError("Выберите допустимую роль");
        await client.query(
          "INSERT INTO admins(telegram_id,role) VALUES($1,$2) ON CONFLICT(telegram_id) DO NOTHING",
          [target, role],
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
          Number(
            (
              await client.query(
                "SELECT COUNT(*) AS count FROM admins WHERE role='super_admin'",
              )
            ).rows[0].count,
          ) <= 1
        )
          throw new ShopError("Нельзя удалить последнего владельца", 409);
        target = Number(row.telegram_id);
        await client.query("DELETE FROM admin_sessions WHERE telegram_id=$1", [
          target,
        ]);
        await client.query("DELETE FROM admins WHERE id=$1", [id]);
      }
      await client.query(
        "INSERT INTO admin_audit(actor,action,target,result) VALUES($1,$2,$3,$4)",
        [
          auth.user.telegramId
            ? `telegram:${auth.user.telegramId}`
            : "owner-key",
          req.method === "POST" ? "admin_added" : "admin_deleted",
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
    return res
      .status(e instanceof ShopError ? e.status : 503)
      .json({
        ok: false,
        error:
          e instanceof ShopError
            ? e.message
            : "Не удалось изменить сотрудников",
      });
  }
}
