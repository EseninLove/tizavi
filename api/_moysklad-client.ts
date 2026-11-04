import { ShopError } from "./_commerce.js";

export const MOYSKLAD_API = "https://api.moysklad.ru/api/remap/1.2";
export interface MoyskladReference {
  id: string;
  name: string;
}
export interface MoyskladReferences {
  organizations: MoyskladReference[];
  stores: MoyskladReference[];
  priceTypes: MoyskladReference[];
}
export interface MoyskladProbe {
  references: MoyskladReferences;
  catalogCount: number;
  preview: { id: string; name: string; type: string }[];
}
export const moyskladId = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export function validateMoyskladToken(value: unknown): string {
  if (typeof value !== "string" || !/^[\x21-\x7e]{20,4096}$/.test(value.trim()))
    throw new ShopError(
      "Вставьте API-токен МоегоСклада целиком, без переносов строк",
    );
  return value.trim();
}
function remoteError(status: number): ShopError {
  if (status === 401)
    return new ShopError(
      "МойСклад отклонил токен. Проверьте его и повторите подключение.",
      400,
    );
  if (status === 403)
    return new ShopError(
      "МойСклад запретил доступ. Проверьте права сотрудника и доступность API на вашем тарифе.",
      403,
    );
  if (status === 429)
    return new ShopError(
      "МойСклад временно ограничил запросы. Подождите минуту и повторите проверку.",
      429,
    );
  return new ShopError(
    "МойСклад временно недоступен. Повторите проверку позже.",
    503,
  );
}
// Only read-only, fixed-origin endpoints are used during connection setup.
export async function probeMoysklad(
  token: string,
  transport: typeof fetch = fetch,
): Promise<MoyskladProbe> {
  token = validateMoyskladToken(token);
  const signal = AbortSignal.timeout(25000);
  async function get(path: string): Promise<any> {
    try {
      const r = await transport(MOYSKLAD_API + path, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Accept-Encoding": "gzip",
        },
        redirect: "error",
        signal,
      });
      if (!r.ok) {
        await r.body?.cancel();
        throw remoteError(r.status);
      }
      const reader = r.body?.getReader();
      if (!reader) throw remoteError(503);
      const parts: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4 * 1024 * 1024) {
          await reader.cancel();
          throw new ShopError(
            "Ответ МоегоСклада слишком большой. Обратитесь к администратору интеграции.",
            503,
          );
        }
        parts.push(value);
      }
      return JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch (error) {
      if (error instanceof ShopError) throw error;
      // Never echo an upstream URL, response body or authorization header.
      throw remoteError(503);
    }
  }
  function reference(row: any): MoyskladReference {
    if (
      !row ||
      !moyskladId(row.id) ||
      typeof row.name !== "string" ||
      !row.name.trim()
    )
      throw new ShopError(
        "МойСклад вернул справочник в неожиданном формате",
        503,
      );
    return { id: row.id.toLowerCase(), name: row.name.slice(0, 250) };
  }
  async function list(path: string): Promise<MoyskladReference[]> {
    const result: MoyskladReference[] = [];
    for (let page = 0; page < 20; page++) {
      const data = await get(`${path}?limit=100&offset=${page * 100}`);
      if (!Array.isArray(data.rows)) throw remoteError(503);
      result.push(...data.rows.map(reference));
      if (
        data.rows.length < 100 ||
        (Number.isSafeInteger(data.meta?.size) &&
          result.length >= data.meta.size)
      )
        return result;
    }
    throw new ShopError(
      "В справочнике МоегоСклада более 2000 записей. Нужна дополнительная настройка интеграции.",
      400,
    );
  }
  const organizations = await list("/entity/organization");
  const stores = await list("/entity/store");
  const prices = await get("/context/companysettings/pricetype");
  if (!Array.isArray(prices)) throw remoteError(503);
  const priceTypes = prices.map(reference);
  const assortment = await get("/entity/assortment?limit=5&offset=0");
  if (!Array.isArray(assortment.rows)) throw remoteError(503);
  return {
    references: { organizations, stores, priceTypes },
    catalogCount:
      Number.isSafeInteger(assortment.meta?.size) && assortment.meta.size >= 0
        ? Math.min(assortment.meta.size, 2147483647)
        : assortment.rows.length,
    preview: assortment.rows
      .slice(0, 5)
      .map((row: any) => ({
        ...reference(row),
        type: ["product", "variant", "service", "bundle"].includes(
          row.meta?.type,
        )
          ? row.meta.type
          : "other",
      })),
  };
}
export function validMoyskladSelection(
  refs: MoyskladReferences,
  values: Record<string, unknown>,
) {
  return (
    [
      ["organizations", "organizationId"],
      ["stores", "storeId"],
      ["priceTypes", "priceTypeId"],
    ] as const
  ).every(
    ([list, key]) =>
      moyskladId(values[key]) &&
      refs[list].some((row) => row.id === String(values[key]).toLowerCase()),
  );
}
