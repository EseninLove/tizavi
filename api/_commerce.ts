export class ShopError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function positiveInteger(value: unknown, max = 100000000): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw new ShopError("Некорректный идентификатор");
  return n;
}
export function calculateItems(
  requested: unknown,
  products: Array<Record<string, any>>,
) {
  if (!Array.isArray(requested) || !requested.length || requested.length > 100)
    throw new ShopError("Добавьте от 1 до 100 позиций");
  const seen = new Set<number>();
  const items = requested.map((item) => {
    const id = positiveInteger(item.productId);
    if (seen.has(id)) throw new ShopError("Товар повторяется в заказе");
    seen.add(id);
    const p = products.find((row) => Number(row.id) === id);
    if (!p || p.in_stock !== true)
      throw new ShopError(`Товар ${p?.name || id} недоступен`);
    const quantity = Number(item.quantity);
    const step = p.unit === "кг" || p.unit === "л" ? 0.5 : 1;
    if (
      !Number.isFinite(quantity) ||
      quantity < step ||
      quantity > 1000 ||
      Math.abs(quantity / step - Math.round(quantity / step)) > 1e-8
    )
      throw new ShopError(`Проверьте количество: ${p.name}`);
    const priceMinor = Math.round(Number(p.price) * 100);
    if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0)
      throw new ShopError(`Цена товара ${p.name} недоступна`);
    return {
      product: {
        id: String(p.id),
        name: p.name,
        image: p.image,
        price: priceMinor / 100,
        unit: p.unit,
        weight: p.weight,
        packageLabel: p.package_label,
      },
      quantity,
      lineTotalMinor: Math.round(priceMinor * quantity),
    };
  });
  const subtotalMinor = items.reduce(
    (sum, item) => sum + item.lineTotalMinor,
    0,
  );
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor > 100000000)
    throw new ShopError("Слишком большая сумма заказа");
  return { items, subtotalMinor };
}
export function mapOrder(r: Record<string, any>) {
  return {
    id: r.order_number,
    items: r.items,
    total: Number(r.total),
    deliveryFee: Number(r.delivery_fee),
    payableTotal: Number(r.payable_total),
    delivery: r.delivery,
    paymentMethod: "yookassa",
    paymentStatus: r.payment_status || "unverified",
    status: r.status,
    createdAt: new Date(r.created_at).getTime(),
  };
}
export function paymentMatches(
  payment: Record<string, any>,
  intent: Record<string, any>,
) {
  return (
    payment.id === intent.provider_id &&
    payment.amount?.currency === "RUB" &&
    Math.round(Number(payment.amount?.value) * 100) ===
      Number(intent.amount_minor) &&
    payment.metadata?.intent_id === intent.id
  );
}
export function canFulfil(status: string, paymentStatus: string) {
  return (
    paymentStatus === "succeeded" &&
    ["paid", "shipped", "delivered"].includes(status)
  );
}
