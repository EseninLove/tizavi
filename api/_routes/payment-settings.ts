import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "../_helpers.js";
import { sql } from "../_db.js";
import { ensureCommerceSchema } from "../_schema.js";
import {
  PROVIDERS,
  ProviderName,
  paymentConfiguration,
  encryptCredentials,
  canStoreCredentials,
} from "../_payment-config.js";
import { ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateAdmin(req);
  if (!auth.authorized || auth.user?.role !== "super_admin")
    return res.status(403).json({
      ok: false,
      error: "Настройки оплаты доступны владельцу магазина",
    });
  try {
    await ensureCommerceSchema();
    if (req.method === "PUT") {
      const { provider, credentials, publicUrl, allowTest, activate } =
        req.body || {};
      if (!Object.prototype.hasOwnProperty.call(PROVIDERS, provider))
        throw new ShopError("Выберите агрегатор");
      const url = new URL(publicUrl);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new ShopError("Укажите HTTPS-адрес магазина");
      if (credentials && Object.values(credentials).some((v) => !!v)) {
        if (
          PROVIDERS[provider as ProviderName].fields.some(
            (f) =>
              typeof credentials[f] !== "string" ||
              !credentials[f].trim() ||
              credentials[f].length > 500,
          )
        )
          throw new ShopError("Заполните все ключи выбранного агрегатора");
        await sql`INSERT INTO payment_credentials(provider,encrypted) VALUES(${provider},${encryptCredentials(credentials)}) ON CONFLICT(provider) DO UPDATE SET encrypted=EXCLUDED.encrypted,updated_at=NOW()`;
      }
      if (activate) {
        const config = await paymentConfiguration(provider);
        if (
          PROVIDERS[provider as ProviderName].fields.some(
            (f) => !config.credentials[f],
          )
        )
          throw new ShopError("Сначала подключите ключи агрегатора");
      }
      await sql`UPDATE payment_settings SET public_url=${url.origin},allow_test=${allowTest === true},active_provider=CASE WHEN ${activate === true} THEN ${provider} ELSE active_provider END WHERE id=1`;
    } else if (req.method !== "GET") return res.status(405).json({ ok: false });
    const current = await paymentConfiguration();
    const providers = await Promise.all(
      Object.entries(PROVIDERS).map(async ([id, info]) => {
        const config = await paymentConfiguration(id as ProviderName);
        return {
          id,
          name: info.name,
          fields: info.fields,
          connected: info.fields.every((f) => !!config.credentials[f]),
        };
      }),
    );
    return res.json({
      ok: true,
      activeProvider: current.name,
      publicUrl: current.publicUrl,
      allowTest: current.allowTest,
      canStoreCredentials: canStoreCredentials(),
      providers,
    });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 400).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось сохранить настройки оплаты",
    });
  }
}
