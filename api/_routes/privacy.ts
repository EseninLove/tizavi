import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, pool } from "../_db.js";
import { ensureCommerceSchema } from "../_schema.js";
import { authenticateAdmin } from "../_helpers.js";
import {
  checkOrigin,
  requireCustomer,
  normalizeEmail,
} from "../_customer-auth.js";
import { ShopError } from "../_commerce.js";

async function mutate(
  text: string,
  values: unknown[],
  actor: string,
  action: string,
  requestId?: number,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(text, values);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      "INSERT INTO privacy_audit(actor,action,request_id) VALUES($1,$2,$3)",
      [actor, action, requestId ?? result.rows[0]?.id ?? null],
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
async function operator() {
  return (
    await sql`SELECT operator_name,inn,address,contact_email,retention,recipients,updated_at FROM privacy_settings WHERE id=1`
  ).rows[0];
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await ensureCommerceSchema();
    if (req.method === "GET" && req.query.admin !== "1")
      return res.json({ ok: true, operator: await operator() });
    if (req.method === "GET" || req.method === "PUT") {
      const auth = await authenticateAdmin(req);
      if (!auth.authorized || auth.user?.role !== "super_admin")
        throw new ShopError("Раздел доступен владельцу магазина", 403);
      if (req.method === "GET")
        return res.json({
          ok: true,
          operator: await operator(),
          requests: (
            await sql`SELECT r.*,u.display_name,u.first_name,u.email FROM privacy_requests r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 200`
          ).rows,
        });
      checkOrigin(req);
      const body = req.body || {},
        actor = `admin:${auth.user.telegramId || "owner-key"}`;
      if (body.action === "settings") {
        const value = (key: string, max: number) => {
          const v = body[key];
          if (typeof v !== "string" || v.trim().length > max)
            throw new ShopError("Проверьте поля настроек");
          return v.trim();
        };
        const name = value("operator_name", 300),
          inn = value("inn", 12),
          address = value("address", 500),
          email = body.contact_email ? normalizeEmail(body.contact_email) : "",
          retention = value("retention", 5000),
          recipients = value("recipients", 5000);
        if (inn && !/^(\d{10}|\d{12})$/.test(inn))
          throw new ShopError("ИНН должен содержать 10 или 12 цифр");
        await mutate(
          "UPDATE privacy_settings SET operator_name=$1,inn=$2,address=$3,contact_email=$4,retention=$5,recipients=$6,updated_at=NOW() WHERE id=1 RETURNING operator_name",
          [name, inn, address, email, retention, recipients],
          actor,
          "operator_settings_updated",
        );
        return res.json({ ok: true, operator: await operator() });
      }
      if (
        body.action !== "respond" ||
        !Number.isSafeInteger(body.id) ||
        body.id < 1 ||
        !["open", "in_progress", "answered"].includes(body.status) ||
        typeof body.reply !== "string" ||
        body.reply.trim().length > 5000 ||
        (body.status === "answered" && !body.reply.trim())
      )
        throw new ShopError("Укажите статус и ответ пользователю");
      const row = await mutate(
        "UPDATE privacy_requests SET status=$1,reply=$2,updated_at=NOW() WHERE id=$3 RETURNING id",
        [body.status, body.reply.trim(), body.id],
        actor,
        "request_status:" + body.status,
        body.id,
      );
      if (!row) throw new ShopError("Обращение не найдено", 404);
      return res.json({ ok: true });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    checkOrigin(req);
    const customer = await requireCustomer(req);
    if (req.body?.action === "my")
      return res.json({
        ok: true,
        requests: (
          await sql`SELECT id,kind,message,status,reply,created_at,updated_at FROM privacy_requests WHERE user_id=${customer.id} ORDER BY created_at DESC LIMIT 100`
        ).rows,
      });
    const { kind, message } = req.body || {};
    if (
      req.body?.action !== "create" ||
      !["access", "correction", "withdrawal", "deletion"].includes(kind) ||
      typeof message !== "string" ||
      message.trim().length > 2000
    )
      throw new ShopError("Проверьте тип обращения и текст (до 2000 символов)");
    const row = await mutate(
      "INSERT INTO privacy_requests(user_id,kind,message) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id",
      [customer.id, kind, message.trim()],
      "customer:" + customer.id,
      "request_created:" + kind,
    );
    if (!row)
      throw new ShopError(
        "Обращение этого типа уже принято. Дождитесь ответа в истории.",
        409,
      );
    return res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    return res.status(e instanceof ShopError ? e.status : 503).json({
      ok: false,
      error:
        e instanceof ShopError
          ? e.message
          : "Не удалось обработать обращение. Повторите попытку.",
    });
  }
}
