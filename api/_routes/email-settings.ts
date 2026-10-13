import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "../_helpers.js";
import { sql } from "../_db.js";
import { ensureCommerceSchema } from "../_schema.js";
import { canStoreCredentials, encryptCredentials } from "../_payment-config.js";
import { normalizeEmail } from "../_customer-auth.js";
import { ShopError } from "../_commerce.js";
async function settings() {
  const row = (
    await sql`SELECT provider,host,port,username,sender,security,encrypted_password IS NOT NULL AS password_saved FROM email_settings WHERE id=1`
  ).rows[0];
  return {
    ok: true,
    settings: row,
    canStoreCredentials: canStoreCredentials(),
    sendingEnabled: false,
    verificationEnabled: false,
  };
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticateAdmin(req);
  if (!auth.authorized || auth.user?.role !== "super_admin")
    return res
      .status(403)
      .json({ ok: false, error: "Настройки почты доступны владельцу" });
  try {
    await ensureCommerceSchema();
    if (req.method === "GET") return res.json(await settings());
    if (req.method !== "PUT") return res.status(405).json({ ok: false });
    const b = req.body || {},
      provider = String(b.provider || "smtp"),
      host = String(b.host || "").trim(),
      port = Number(b.port),
      username = String(b.username || "").trim(),
      sender = b.sender ? normalizeEmail(b.sender) : "",
      security = String(b.security || "tls");
    if (
      !["smtp", "yandex", "mailru"].includes(provider) ||
      !["tls", "starttls"].includes(security) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      host.length > 253 ||
      (host && !/^[a-zA-Z0-9.-]+$/.test(host)) ||
      username.length > 254
    )
      throw new ShopError("Проверьте настройки почтового сервиса");
    let encrypted: string | null = null;
    if (b.password) {
      if (typeof b.password !== "string" || b.password.length > 500)
        throw new ShopError("Проверьте пароль");
      encrypted = encryptCredentials({ password: b.password });
    }
    await sql`UPDATE email_settings SET provider=${provider},host=${host},port=${port},username=${username},sender=${sender},security=${security},encrypted_password=COALESCE(${encrypted},encrypted_password),updated_at=NOW() WHERE id=1`;
    return res.json(await settings());
  } catch (e) {
    return res.status(e instanceof ShopError ? e.status : 503).json({
      ok: false,
      error:
        e instanceof ShopError
          ? e.message
          : "Не удалось сохранить настройки почты",
    });
  }
}
