import { limitRequest } from "../_security.js";
import { ShopError } from "../_commerce.js";
import { requireCustomer } from "../_customer-auth.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, authenticateAdmin, sendJSON, unauthorized } from "../_helpers.js";

const BOT_TOKEN = process.env.BOT_TOKEN || "";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];

async function notifyAdmins(): Promise<void> {
  if (!BOT_TOKEN) return;

  try {
    const admins = await sql`SELECT telegram_id FROM admins`;
    const text =
      "В магазине новое обращение в поддержку. Подробности доступны в защищённой админке.";

    for (const row of admins.rows) {
      const adminId = (row as { telegram_id: number }).telegram_id;
      if (!adminId) continue;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }
  } catch {
    // уведомления не должны ломать создание тикета
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  // POST /api/support — создать тикет (пользователь) или получить свои тикеты (action: 'my')
  if (req.method === "POST") {
    const { subject, message, action } = (req.body || {}) as {
      initData?: string;
      subject?: string;
      message?: string;
      action?: "my";
    };

    let customer;
    try {
      customer = await requireCustomer(req);
    } catch (e) {
      return sendJSON(res, 401, {
        ok: false,
        error: "Войдите в аккаунт, чтобы написать в поддержку",
      });
    }
    const userId = Number(customer.id);
    if (action === "my") {
      try {
        const result = await sql`
          SELECT id, subject, message, reply, status, created_at
          FROM support_tickets
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 30
        `;
        return sendJSON(res, 200, { ok: true, tickets: result.rows });
      } catch {
        return sendJSON(res, 200, { ok: true, tickets: [] });
      }
    }

    if (!subject?.trim() || !message?.trim()) {
      return sendJSON(res, 400, {
        ok: false,
        error: "Заполните тему и сообщение",
      });
    }

    try {
      await limitRequest("support-create", String(userId), 5, 600);
    } catch (e) {
      return sendJSON(res, e instanceof ShopError ? e.status : 503, {
        ok: false,
        error:
          e instanceof ShopError ? e.message : "Сервис временно недоступен",
      });
    }
    const userName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email ||
      "Пользователь";
    if (subject.length > 150 || message.length > 3500)
      return sendJSON(res, 400, {
        ok: false,
        error: "Сообщение слишком длинное",
      });
    try {
      const result = await sql`
        INSERT INTO support_tickets (user_id, telegram_id, username, user_name, subject, message, status)
        VALUES (${userId}, ${customer.telegram_id}, ${customer.username ?? null}, ${userName}, ${subject.trim()}, ${message.trim()}, 'open')
        RETURNING id, created_at
      `;
      const row = result.rows[0] as { id: number; created_at: string };

      await notifyAdmins();

      return sendJSON(res, 201, {
        ok: true,
        ticket: { id: row.id, status: "open", createdAt: row.created_at },
        message: "Заявка отправлена",
      });
    } catch (err) {
      return sendJSON(res, 500, {
        ok: false,
        error: "Ошибка создания заявки",
      });
    }
  }

  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  // GET /api/support — список тикетов (админ)
  if (req.method === "GET") {
    const status =
      typeof req.query.status === "string" ? req.query.status : null;

    try {
      const result =
        status && status !== "all"
          ? await sql`SELECT * FROM support_tickets WHERE status = ${status} ORDER BY created_at DESC`
          : await sql`SELECT * FROM support_tickets ORDER BY created_at DESC`;

      return sendJSON(res, 200, { ok: true, tickets: result.rows });
    } catch {
      return sendJSON(res, 500, {
        ok: false,
        error: "Ошибка получения заявок",
      });
    }
  }

  // PUT /api/support?id=X — смена статуса / ответ (админ)
  if (req.method === "PUT") {
    const ticketId = parseInt(req.query.id as string, 10);
    if (isNaN(ticketId)) {
      return sendJSON(res, 400, { ok: false, error: "Невалидный ID" });
    }

    const { status, reply } = (req.body || {}) as {
      status?: string;
      reply?: string;
    };

    try {
      if (status) {
        if (!VALID_STATUSES.includes(status)) {
          return sendJSON(res, 400, {
            ok: false,
            error: `Статус должен быть одним из: ${VALID_STATUSES.join(", ")}`,
          });
        }
        await sql`
          UPDATE support_tickets SET status = ${status}, updated_at = NOW()
          WHERE id = ${ticketId}
        `;
      }

      if (reply && reply.trim()) {
        await sql`
          UPDATE support_tickets
          SET reply = ${reply.trim()}, replied_at = NOW(), updated_at = NOW(),
              status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
          WHERE id = ${ticketId}
        `;

        const found =
          await sql`SELECT telegram_id FROM support_tickets WHERE id = ${ticketId}`;
        const ticketUserId = (
          found.rows[0] as { telegram_id: number } | undefined
        )?.telegram_id;

        if (ticketUserId && BOT_TOKEN) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ticketUserId,
              text: "В личном кабинете есть ответ поддержки. Откройте раздел «Поддержка» в магазине.",
            }),
          }).catch(() => {});
        }
      }

      return sendJSON(res, 200, { ok: true, message: "Заявка обновлена" });
    } catch {
      return sendJSON(res, 500, {
        ok: false,
        error: "Ошибка обновления заявки",
      });
    }
  }

  return sendJSON(res, 405, { ok: false, error: "Method not allowed" });
}
