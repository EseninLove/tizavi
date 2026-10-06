import crypto from "node:crypto";
import { sql } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { ShopError } from "./_commerce.js";
export const PROVIDERS = {
  yookassa: {
    name: "ЮKassa",
    fields: ["shopId", "secretKey"],
    env: ["YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY"],
  },
  tbank: {
    name: "Т-Банк",
    fields: ["terminalKey", "password"],
    env: ["TBANK_TERMINAL_KEY", "TBANK_PASSWORD"],
  },
};
export type ProviderName = keyof typeof PROVIDERS;
function key(
  source: string = process.env.PAYMENT_SETTINGS_KEY ? "master" : "bot",
) {
  if (source === "bot") {
    const token = process.env.BOT_TOKEN || "";
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token))
      throw new ShopError("Настройте защиту ключей на сервере", 503);
    return crypto
      .createHmac("sha256", token)
      .update("tizavi/payment-credentials/v1")
      .digest();
  }
  if (source !== "master")
    throw new ShopError("Неизвестный формат защиты ключей", 503);
  const value = process.env.PAYMENT_SETTINGS_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new ShopError(
      "Для сохранения ключей задайте PAYMENT_SETTINGS_KEY на сервере (64 шестнадцатеричных символа)",
      503,
    );
  return Buffer.from(value, "hex");
}
export function canStoreCredentials() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}
export function encryptCredentials(data: Record<string, string>) {
  const source = process.env.PAYMENT_SETTINGS_KEY ? "master" : "bot";
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key(source), iv);
  const content = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return (
    source +
    "." +
    [iv, cipher.getAuthTag(), content]
      .map((b) => b.toString("base64"))
      .join(".")
  );
}
export function decryptCredentials(value: string) {
  const parts = value.split(".");
  const source = parts.length === 4 ? parts.shift()! : "master";
  const [iv, tag, content] = parts.map((v) => Buffer.from(v, "base64"));
  const cipher = crypto.createDecipheriv("aes-256-gcm", key(source), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(content), cipher.final()]).toString("utf8"),
  ) as Record<string, string>;
}
export async function paymentConfiguration(provider?: ProviderName) {
  await ensureCommerceSchema();
  const settings = (await sql`SELECT * FROM payment_settings WHERE id=1`)
    .rows[0] as Record<string, any>;
  const name = provider || (settings.active_provider as ProviderName);
  if (!Object.prototype.hasOwnProperty.call(PROVIDERS, name))
    throw new ShopError("Неизвестный агрегатор");
  const row = (
    await sql`SELECT encrypted FROM payment_credentials WHERE provider=${name}`
  ).rows[0];
  const credentials = row
    ? decryptCredentials(String(row.encrypted))
    : Object.fromEntries(
        PROVIDERS[name].fields.map((field, i) => [
          field,
          process.env[PROVIDERS[name].env[i]] || "",
        ]),
      );
  const publicUrl = settings.public_url || process.env.PUBLIC_APP_URL || "";
  return {
    name,
    credentials,
    publicUrl,
    allowTest:
      !!settings.allow_test || process.env.YOOKASSA_ALLOW_TEST === "true",
    configured:
      PROVIDERS[name].fields.every((f) => !!credentials[f]) && !!publicUrl,
  };
}
export async function paymentsConfigured() {
  try {
    return (await paymentConfiguration()).configured;
  } catch {
    return false;
  }
}
