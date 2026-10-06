import { sql } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { ShopError } from "./_commerce.js";
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function deliveryEstimate(
  warehouses: Array<Record<string, any>>,
  point: { latitude: number; longitude: number },
  settings: Record<string, any>,
  subtotalMinor: number,
  now = new Date(),
) {
  const nearby: Array<Record<string, any>> = warehouses
    .filter((w) => w.active && Number(w.courier_count) > 0)
    .map(
      (w) =>
        ({
          ...w,
          distance: distanceKm(
            { latitude: Number(w.latitude), longitude: Number(w.longitude) },
            point,
          ),
        }) as Record<string, any>,
    )
    .filter((w) => w.distance <= Number(w.radius_km))
    .sort((a, b) => a.distance - b.distance);
  const warehouse = nearby[0];
  if (!warehouse)
    throw new ShopError(
      "Пока не доставляем по этому адресу: нет доступного склада и курьера",
    );
  const routeKm = warehouse.distance * Number(settings.road_factor);
  const feeMinor =
    subtotalMinor >= Number(settings.free_from) * 100
      ? 0
      : Math.round(
          (Number(settings.base_fee) + routeKm * Number(settings.per_km)) * 100,
        );
  const moscow = new Date(now.getTime() + 3 * 3600000);
  const hour = moscow.getUTCHours() + moscow.getUTCMinutes() / 60;
  let start = new Date(now);
  if (
    hour < Number(warehouse.open_hour) ||
    hour + Number(warehouse.preparation_minutes) / 60 >=
      Number(warehouse.close_hour)
  ) {
    start = new Date(
      Date.UTC(
        moscow.getUTCFullYear(),
        moscow.getUTCMonth(),
        moscow.getUTCDate() +
          (hour + Number(warehouse.preparation_minutes) / 60 >=
          Number(warehouse.close_hour)
            ? 1
            : 0),
        Number(warehouse.open_hour) - 3,
      ),
    );
  }
  const minutes =
    Number(warehouse.preparation_minutes) +
    Math.ceil((routeKm / Number(settings.speed_kmh)) * 60);
  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    distanceKm: Math.round(warehouse.distance * 10) / 10,
    fee: feeMinor / 100,
    estimated: true,
    earliestAt: new Date(start.getTime() + minutes * 60000).toISOString(),
    latestAt: new Date(start.getTime() + (minutes + 30) * 60000).toISOString(),
  };
}
async function dadata(method: string, body: Record<string, unknown>) {
  if (!process.env.DADATA_TOKEN)
    throw new ShopError(
      "Проверка адресов пока не подключена. Мы доставляем по Москве и Московской области.",
      503,
    );
  const response = await fetch(
    `https://suggestions.dadata.ru/suggestions/api/4_1/rs/${method}/address`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DADATA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new ShopError("Сервис адресов временно недоступен", 503);
  return (
    (
      (await response.json()) as {
        suggestions: Array<{
          value: string;
          data: Record<string, string | null>;
        }>;
      }
    ).suggestions || []
  );
}
export async function suggestAddresses(query: string) {
  if (
    typeof query !== "string" ||
    query.trim().length < 3 ||
    query.length > 200
  )
    throw new ShopError("Введите улицу и номер дома");
  const suggestions = await dadata("suggest", {
    query,
    count: 5,
    locations: [
      { region_kladr_id: "7700000000000" },
      { region_kladr_id: "5000000000000" },
    ],
    restrict_value: true,
    from_bound: { value: "house" },
    to_bound: { value: "house" },
  });
  return suggestions
    .filter(
      (s) =>
        s.data.house &&
        ["77", "50"].includes(String(s.data.region_kladr_id).slice(0, 2)),
    )
    .map((s) => ({ id: s.data.fias_id, value: s.value }));
}
export async function quoteAddress(addressId: string, subtotalMinor: number) {
  if (typeof addressId !== "string" || !/^[\da-f-]{36}$/i.test(addressId))
    throw new ShopError("Выберите адрес с номером дома из подсказок");
  await ensureCommerceSchema();
  const suggestions = await dadata("findById", { query: addressId, count: 1 });
  const address = suggestions[0];
  if (
    !address?.data.house ||
    !["77", "50"].includes(String(address.data.region_kladr_id).slice(0, 2))
  )
    throw new ShopError(
      "Доставка доступна только по Москве и Московской области",
    );
  if (!address.data.geo_lat || !address.data.geo_lon)
    throw new ShopError(
      "Для этого дома пока нет координат. Выберите другой адрес или обратитесь в поддержку",
    );
  const latitude = Number(address.data.geo_lat),
    longitude = Number(address.data.geo_lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
    throw new ShopError("Не удалось определить адрес");
  const warehouses = (
    await sql`SELECT w.*, (SELECT COUNT(*) FROM couriers c WHERE c.warehouse_id=w.id AND c.active) AS courier_count FROM warehouses w WHERE w.active`
  ).rows;
  const settings = (await sql`SELECT * FROM delivery_settings WHERE id=1`)
    .rows[0];
  return {
    addressId,
    address: address.value,
    city: address.data.city || address.data.settlement || address.data.region,
    ...deliveryEstimate(
      warehouses,
      { latitude, longitude },
      settings,
      subtotalMinor,
    ),
  };
}
