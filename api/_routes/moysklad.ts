import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin } from "../_helpers.js";
import { sql } from "../_db.js";
import { ensureCommerceSchema } from "../_schema.js";
import {
  encryptCredentials,
  decryptCredentials,
  canStoreCredentials,
} from "../_payment-config.js";
import { ShopError } from "../_commerce.js";
import { clientAddress, limitRequest, sameOrigin } from "../_security.js";
import {
  probeMoysklad,
  validateMoyskladToken,
  validMoyskladSelection,
} from "../_moysklad-client.js";

import { syncMoyskladCategories } from "../_moysklad-categories.js";

async function settings() {
  return (await sql`SELECT * FROM moysklad_settings WHERE id=1`).rows[0] as any;
}
function view(row: any) {
  const selection = {
    organizationId: row.organization_id || "",
    storeId: row.store_id || "",
    priceTypeId: row.price_type_id || "",
  };
  return {
    ok: true,
    tokenSaved: !!row.token_encrypted,
    canStoreCredentials: canStoreCredentials(),
    checkedAt: row.checked_at,
    lastError: row.last_error,
    references: row.reference_data,
    catalogCount: row.catalog_count,
    preview: row.catalog_preview,
    selection,
    configured:
      !!row.token_encrypted &&
      !!row.checked_at &&
      !row.last_error &&
      validMoyskladSelection(row.reference_data, selection),
    synchronizationEnabled: false,
    categoriesEnabled: row.categories_enabled,
    categoriesSyncedAt: row.categories_synced_at,
    categoriesError: row.categories_error,
  };
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticateAdmin(req);
  if (!auth.authorized || auth.user?.role !== "super_admin")
    return res.status(403).json({
      ok: false,
      error: "Подключение МоегоСклада доступно только владельцу магазина",
    });
  try {
    await ensureCommerceSchema();
    if (req.method === "GET") return res.json(view(await settings()));
    if (!["POST", "PUT", "DELETE"].includes(req.method || ""))
      return res.status(405).json({ ok: false });
    sameOrigin(req);
    const b = req.body || {};
    if (
      req.method === "POST" &&
      ["categories-export", "categories-sync"].includes(b.action)
    ) {
      await limitRequest("moysklad-categories", clientAddress(req), 10, 900);
      const result = await syncMoyskladCategories(
        b.action === "categories-export",
      );
      return res.json({ ...view(await settings()), categoryResult: result });
    } else if (req.method === "PUT" && b.action === "categories-pause") {
      await sql`UPDATE moysklad_settings SET categories_enabled=FALSE WHERE id=1`;
    } else if (req.method === "DELETE") {
      await sql`UPDATE moysklad_settings SET categories_enabled=FALSE,token_encrypted=NULL,organization_id=NULL,store_id=NULL,price_type_id=NULL,reference_data='{"organizations":[],"stores":[],"priceTypes":[]}'::jsonb,catalog_count=0,catalog_preview='[]'::jsonb,checked_at=NULL,last_error=NULL,updated_at=NOW() WHERE id=1`;
    } else if (req.method === "PUT" && b.action === "token") {
      await limitRequest("moysklad-check", clientAddress(req), 10, 900);
      if (!canStoreCredentials())
        throw new ShopError("На сервере не настроена защита ключей", 503);
      const token = validateMoyskladToken(b.token);
      const data = await probeMoysklad(token);
      await sql`UPDATE moysklad_settings SET categories_enabled=FALSE,token_encrypted=${encryptCredentials({ accessToken: token })},organization_id=NULL,store_id=NULL,price_type_id=NULL,reference_data=${JSON.stringify(data.references)}::jsonb,catalog_count=${data.catalogCount},catalog_preview=${JSON.stringify(data.preview)}::jsonb,checked_at=NOW(),last_error=NULL,updated_at=NOW() WHERE id=1`;
    } else if (req.method === "POST" && b.action === "check") {
      await limitRequest("moysklad-check", clientAddress(req), 10, 900);
      const row = await settings();
      if (!row.token_encrypted)
        throw new ShopError("Сначала подключите API-токен");
      try {
        let token: string;
        try {
          token = validateMoyskladToken(
            decryptCredentials(row.token_encrypted).accessToken,
          );
        } catch {
          throw new ShopError(
            "Не удалось прочитать сохранённый токен. Подключите его заново.",
            503,
          );
        }
        const data = await probeMoysklad(token);
        const updated =
          await sql`UPDATE moysklad_settings SET reference_data=${JSON.stringify(data.references)}::jsonb,catalog_count=${data.catalogCount},catalog_preview=${JSON.stringify(data.preview)}::jsonb,checked_at=NOW(),last_error=NULL,updated_at=NOW() WHERE id=1 AND token_encrypted=${row.token_encrypted} RETURNING id`;
        if (!updated.rowCount)
          throw new ShopError(
            "Подключение уже изменилось. Обновите страницу.",
            409,
          );
      } catch (e) {
        const message =
          e instanceof ShopError ? e.message : "МойСклад временно недоступен";
        await sql`UPDATE moysklad_settings SET last_error=${message},updated_at=NOW() WHERE id=1 AND token_encrypted=${row.token_encrypted}`;
        throw e;
      }
    } else if (req.method === "PUT" && b.action === "selection") {
      const row = await settings();
      if (!row.token_encrypted || !row.checked_at || row.last_error)
        throw new ShopError("Сначала выполните успешную проверку подключения");
      if (!validMoyskladSelection(row.reference_data, b))
        throw new ShopError(
          "Выберите организацию, склад и тип цен из МоегоСклада",
        );
      const updated =
        await sql`UPDATE moysklad_settings SET organization_id=${String(b.organizationId).toLowerCase()}::uuid,store_id=${String(b.storeId).toLowerCase()}::uuid,price_type_id=${String(b.priceTypeId).toLowerCase()}::uuid,updated_at=NOW() WHERE id=1 AND token_encrypted=${row.token_encrypted} AND last_error IS NULL RETURNING id`;
      if (!updated.rowCount)
        throw new ShopError(
          "Подключение уже изменилось. Обновите страницу.",
          409,
        );
    } else throw new ShopError("Неизвестное действие");
    return res.json(view(await settings()));
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось обновить подключение МоегоСклада",
    });
  }
}
