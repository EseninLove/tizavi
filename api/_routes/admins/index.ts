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
    if (req.method === "GET") {
      if (req.query.candidates === "1") {
        const q =
          typeof req.query.q === "string"
            ? req.query.q.trim().slice(0, 100)
            : "";
        const page = Math.max(
          0,
          Math.min(100000, Math.floor(Number(req.query.page) || 0)),
        );
        const pattern = "%" + q + "%";
        const rows = (
          await sql`SELECT u.id,u.display_name,u.first_name,u.last_name,u.email,u.username,u.photo_url,u.last_seen FROM users u WHERE NOT EXISTS(SELECT 1 FROM admins a WHERE a.user_id=u.id OR a.telegram_id=u.telegram_id) AND (COALESCE(u.email,'') ILIKE ${pattern} OR CONCAT_WS(' ',u.display_name,u.first_name,u.last_name,u.username) ILIKE ${pattern}) ORDER BY u.last_seen DESC,u.id DESC LIMIT 51 OFFSET ${page * 50}`
        ).rows;
        return res.json({
          ok: true,
          users: rows.slice(0, 50),
          hasMore: rows.length > 50,
        });
      }
      return res.json({
        ok: true,
        admins: (
          await sql`SELECT a.id,a.user_id,a.telegram_id,a.role,a.created_at,COALESCE(NULLIF(u.display_name,''),NULLIF(CONCAT_WS(' ',u.first_name,u.last_name),''),u.email,NULLIF(a.name,''),'Сотрудник') AS name,u.email,u.username FROM admins a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at LIMIT 500`
        ).rows,
      });
    }
    if (!["POST", "PUT", "DELETE"].includes(req.method || ""))
      return res.status(405).json({ ok: false });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(78264322)");
      let target: number;
      const role = req.body?.role ?? "admin";
      if (req.method !== "DELETE" && !isStaffRole(role))
        throw new ShopError("Выберите допустимую роль сотрудника");
      if (req.method === "POST") {
        target = positiveInteger(req.body?.userId);
        const selected = (
          await client.query(
            "SELECT id,telegram_id FROM users WHERE id=$1 FOR KEY SHARE",
            [target],
          )
        ).rows[0];
        if (!selected)
          throw new ShopError("Выберите зарегистрированного пользователя", 404);
        const duplicate = await client.query(
          "SELECT id FROM admins WHERE user_id=$1 OR (telegram_id=$2 AND $2 IS NOT NULL)",
          [target, selected.telegram_id],
        );
        if (duplicate.rows.length)
          throw new ShopError(
            "Права этому пользователю уже выданы. Измените роль в списке сотрудников.",
            409,
          );
        await client.query(
          "INSERT INTO admins(user_id,telegram_id,role) VALUES($1,$2,$3)",
          [target, selected.telegram_id, role],
        );
      } else {
        const id = positiveInteger(req.query.id);
        const row = (
          await client.query(
            "SELECT user_id,telegram_id,role FROM admins WHERE id=$1 FOR UPDATE",
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
        target = Number(row.user_id || row.telegram_id);
        if (req.method === "DELETE" || role !== row.role)
          await client.query(
            "DELETE FROM admin_sessions WHERE user_id=$1 OR (telegram_id=$2 AND $2 IS NOT NULL)",
            [row.user_id, row.telegram_id],
          );
        if (req.method === "PUT")
          await client.query("UPDATE admins SET role=$2 WHERE id=$1", [
            id,
            role,
          ]);
        else await client.query("DELETE FROM admins WHERE id=$1", [id]);
      }
      await client.query(
        "INSERT INTO admin_audit(actor,action,target,result) VALUES($1,$2,$3,$4)",
        [
          auth.user.userId ? `account:${auth.user.userId}` : "owner-key",
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
