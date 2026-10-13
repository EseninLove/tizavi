import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_db.js";
import { ShopError } from "../_commerce.js";
import { ensureCommerceSchema } from "../_schema.js";
import {
  authenticateCustomer,
  checkOrigin,
  createSession,
  hashPassword,
  limitAuth,
  normalizeEmail,
  publicCustomer,
  removeSession,
  sessionCustomer,
  validatePassword,
  verifyPassword,
  type Customer,
} from "../_customer-auth.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const user = await sessionCustomer(req);
      return res.json({ ok: true, user: user ? publicCustomer(user) : null });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    checkOrigin(req);
    await ensureCommerceSchema();
    const action = req.body?.action;
    if (req.body?.initData && ["register", "login"].includes(action))
      throw new ShopError("В Telegram добавьте email к текущему профилю");
    if (action === "me") {
      const user = await authenticateCustomer(req);
      return res.json({ ok: true, user: user ? publicCustomer(user) : null });
    }
    if (action === "logout") {
      checkOrigin(req, true);
      await removeSession(req, res);
      return res.json({ ok: true, user: null });
    }
    if (
      !["register", "login", "attach-email", "change-password"].includes(action)
    )
      throw new ShopError("Неизвестное действие");
    const email =
      action === "change-password" ? "" : normalizeEmail(req.body?.email);
    await limitAuth(req, email);
    if (action === "change-password") {
      const user = await authenticateCustomer(req);
      if (!user) throw new ShopError("Войдите в аккаунт", 401);
      validatePassword(req.body?.password);
      const row = (
        await sql<{
          password_hash: string;
        }>`SELECT password_hash FROM users WHERE id=${user.id}`
      ).rows[0];
      if (
        typeof req.body?.currentPassword !== "string" ||
        req.body.currentPassword.length > 128 ||
        !(await verifyPassword(req.body.currentPassword, row.password_hash))
      )
        throw new ShopError("Текущий пароль неверен", 401);
      const hash = await hashPassword(req.body.password);
      await sql`UPDATE users SET password_hash=${hash} WHERE id=${user.id}`;
      await sql`DELETE FROM customer_sessions WHERE user_id=${user.id}`;
      await createSession(req, res, user.id);
      return res.json({ ok: true, user: publicCustomer(user) });
    }
    if (action === "login") {
      if (
        typeof req.body?.password !== "string" ||
        req.body.password.length > 128
      )
        throw new ShopError("Email или пароль неверны", 401);
      const row = (
        await sql<
          Customer & { password_hash: string }
        >`SELECT * FROM users WHERE lower(email)=${email}`
      ).rows[0];
      if (
        !(await verifyPassword(
          req.body.password,
          row?.password_hash || null,
        )) ||
        !row
      )
        throw new ShopError("Email или пароль неверны", 401);
      await sql`UPDATE users SET last_seen=NOW() WHERE id=${row.id}`;
      await createSession(req, res, Number(row.id));
      return res.json({ ok: true, user: publicCustomer(row) });
    }
    validatePassword(req.body?.password);
    const name = String(req.body?.name || "").trim();
    if (name.length > 100) throw new ShopError("Имя слишком длинное");
    const hash = await hashPassword(req.body.password);
    let user: Customer;
    if (action === "attach-email") {
      const current = await authenticateCustomer(req);
      if (!current) throw new ShopError("Войдите в аккаунт", 401);
      if (current.email)
        throw new ShopError("Email уже добавлен к этому аккаунту", 409);
      // Never merge accounts based on an unverified email or a client-supplied Telegram ID.
      user = (
        await sql<Customer>`UPDATE users SET email=${email},password_hash=${hash},email_verified=FALSE WHERE id=${current.id} AND email IS NULL RETURNING *`
      ).rows[0];
      if (!user) throw new ShopError("Email уже добавлен", 409);
    } else {
      user = (
        await sql<Customer>`INSERT INTO users(email,password_hash,first_name,email_verified,last_seen) VALUES(${email},${hash},${name || null},FALSE,NOW()) RETURNING *`
      ).rows[0];
    }
    await createSession(req, res, Number(user.id));
    return res
      .status(action === "register" ? 201 : 200)
      .json({ ok: true, user: publicCustomer(user) });
  } catch (e) {
    const duplicate = (e as { code?: string })?.code === "23505";
    return res
      .status(duplicate ? 409 : e instanceof ShopError ? e.status : 503)
      .json({
        ok: false,
        error: duplicate
          ? "Этот email уже используется. Войдите в существующий аккаунт."
          : e instanceof ShopError
            ? e.message
            : "Не удалось выполнить вход. Повторите попытку.",
      });
  }
}
