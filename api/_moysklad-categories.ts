import crypto from "node:crypto";
import { pool } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { decryptCredentials } from "./_payment-config.js";
import {
  MOYSKLAD_API,
  moyskladId,
  validateMoyskladToken,
} from "./_moysklad-client.js";
import { ShopError } from "./_commerce.js";

type Folder = {
  id: string;
  name: string;
  archived?: boolean;
  externalCode?: string;
  productFolder?: { meta?: { href?: string } };
};
export async function folderRequest(
  token: string,
  suffix = "",
  body?: { externalCode: string; name: string },
  transport: typeof fetch = fetch,
): Promise<any> {
  if (!/^(?:\?limit=100&offset=\d+|\/[a-f0-9-]{36})?$/.test(suffix))
    throw new ShopError("Неверный адрес группы");
  try {
    const r = await transport(MOYSKLAD_API + "/entity/productfolder" + suffix, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${validateMoyskladToken(token)}`,
        Accept: "application/json;charset=utf-8",
        "Accept-Encoding": "gzip",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 404 && !body) {
      await r.body?.cancel();
      return null;
    }
    if (!r.ok) {
      await r.body?.cancel();
      throw new ShopError(
        r.status === 401 || r.status === 403
          ? "МойСклад отклонил доступ к группам. Проверьте токен, права сотрудника и тариф."
          : "Не удалось получить группы МоегоСклада. Повторите синхронизацию позже.",
        503,
      );
    }
    const reader = r.body!.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new Error();
      }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch (e) {
    if (e instanceof ShopError) throw e;
    throw new ShopError(
      "МойСклад не ответил вовремя. Повторите синхронизацию позже.",
      503,
    );
  }
}
function folder(row: any): Folder {
  if (
    !row ||
    !moyskladId(row.id) ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    row.name.length > 255
  )
    throw new ShopError("Неожиданный формат группы МоегоСклада", 503);
  return {
    id: row.id.toLowerCase(),
    name: row.name,
    archived: row.archived === true,
    externalCode:
      typeof row.externalCode === "string" ? row.externalCode : undefined,
    productFolder: row.productFolder,
  };
}
export async function readFolders(
  token: string,
  transport: typeof fetch = fetch,
) {
  const rows: Folder[] = [];
  for (let page = 0; page < 100; page++) {
    const data = await folderRequest(
      token,
      `?limit=100&offset=${page * 100}`,
      undefined,
      transport,
    );
    if (!data || !Array.isArray(data.rows))
      throw new ShopError("Неожиданный формат списка групп МоегоСклада", 503);
    rows.push(...data.rows.map(folder));
    if (
      data.rows.length < 100 ||
      (Number.isSafeInteger(data.meta?.size) && rows.length >= data.meta.size)
    ) {
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        throw new ShopError(
          "Список групп изменился во время чтения. Повторите синхронизацию",
          409,
        );
      return rows;
    }
  }
  throw new ShopError(
    "Более 10000 групп: требуется дополнительная настройка",
    400,
  );
}
/** The same lock protects the scheduler, manual import and initial export. */
export async function syncMoyskladCategories(
  exportExisting = false,
  scheduled = false,
) {
  await ensureCommerceSchema();
  const c = await pool.connect();
  let locked = false;
  let transaction = false;
  try {
    locked = (await c.query("SELECT pg_try_advisory_lock(78264322) AS locked"))
      .rows[0].locked;
    if (!locked)
      throw new ShopError(
        "Синхронизация уже выполняется. Подождите немного.",
        409,
      );
    const settings = (
      await c.query("SELECT * FROM moysklad_settings WHERE id=1")
    ).rows[0];
    if (scheduled && !settings.categories_enabled) return { skipped: true };
    if (!settings.token_encrypted)
      throw new ShopError("Сначала подключите API-токен МоегоСклада");
    const token = validateMoyskladToken(
      decryptCredentials(settings.token_encrypted).accessToken,
    );
    let folders = await readFolders(token);
    let exported = 0;
    if (exportExisting) {
      const local = (
        await c.query(
          "SELECT * FROM categories WHERE moysklad_id IS NULL ORDER BY id",
        )
      ).rows;
      // Persist a recovery code BEFORE the remote write; API IDs are read-only.
      for (const cat of local) {
        const recoveryCode = cat.moysklad_export_id
          ? `tizavi-category-${cat.moysklad_export_id}`
          : null;
        const match = recoveryCode
          ? folders.filter((f) => f.externalCode === recoveryCode)
          : folders.filter(
              (f) =>
                !f.archived &&
                !f.productFolder &&
                f.name.trim().toLocaleLowerCase("ru") ===
                  cat.name.trim().toLocaleLowerCase("ru"),
            );
        if (match.length > 1)
          throw new ShopError(
            `В МоёмСкладе несколько групп «${cat.name}». Устраните дубли перед переносом.`,
            409,
          );
        let remote = match[0];
        if (!remote) {
          const exportId = cat.moysklad_export_id || crypto.randomUUID();
          await c.query(
            "UPDATE categories SET moysklad_export_id=$1 WHERE id=$2",
            [exportId, cat.id],
          );
          remote = folder(
            await folderRequest(token, "", {
              externalCode: `tizavi-category-${exportId}`,
              name: cat.name,
            }),
          );
          folders.push(remote);
          exported++;
        }
        await c.query("UPDATE categories SET moysklad_id=$1 WHERE id=$2", [
          remote.id,
          cat.id,
        ]);
      }
      folders = await readFolders(token);
    }
    // Apply only a complete snapshot; never hide categories after a partial/failed page.
    await c.query("BEGIN");
    transaction = true;
    const fresh = (
      await c.query(
        "SELECT token_encrypted,categories_enabled FROM moysklad_settings WHERE id=1 FOR UPDATE",
      )
    ).rows[0];
    if (fresh.token_encrypted !== settings.token_encrypted)
      throw new ShopError(
        "Токен изменён во время синхронизации. Повторите операцию.",
        409,
      );
    if (scheduled && !fresh.categories_enabled) {
      await c.query("ROLLBACK");
      transaction = false;
      return { skipped: true };
    }
    const present = folders.map((f) => f.id);
    await c.query(
      "UPDATE categories SET moysklad_hidden=TRUE WHERE moysklad_id IS NOT NULL AND NOT (moysklad_id=ANY($1::uuid[]))",
      [present],
    );
    let created = 0;
    for (const f of folders) {
      const updated = await c.query(
        "UPDATE categories SET name=$1,moysklad_hidden=$2 WHERE moysklad_id=$3 RETURNING id",
        [f.name, !!f.archived, f.id],
      );
      if (!updated.rowCount && !f.archived) {
        await c.query(
          "INSERT INTO categories(slug,name,moysklad_id,sort_order) VALUES($1,$2,$3,COALESCE((SELECT MAX(sort_order)+1 FROM categories),0))",
          ["cat_" + crypto.randomUUID(), f.name, f.id],
        );
        created++;
      }
    }
    await c.query(
      "UPDATE moysklad_settings SET categories_enabled=TRUE,categories_synced_at=NOW(),categories_error=NULL WHERE id=1",
    );
    await c.query("COMMIT");
    transaction = false;
    return { exported, created, groups: folders.length };
  } catch (e) {
    if (transaction) await c.query("ROLLBACK");
    if (locked)
      await c.query(
        "UPDATE moysklad_settings SET categories_error=$1 WHERE id=1",
        [
          e instanceof ShopError
            ? e.message
            : "Не удалось синхронизировать категории",
        ],
      );
    throw e;
  } finally {
    try {
      if (locked) await c.query("SELECT pg_advisory_unlock(78264322)");
    } finally {
      c.release();
    }
  }
}
