import type { Order } from "../types";
export const orderStatusLabels = {
  pending: "Ожидает оплаты",
  paid: "Принят",
  shipped: "Передан курьеру",
  delivered: "Доставлен",
  cancelled: "Отменён",
};
export const paymentStatusLabels = {
  pending: "Не оплачен",
  succeeded: "Оплачен",
  canceled: "Оплата отменена",
  unverified: "Оплата требует проверки",
};
export function orderStatusLabel(order: Order) {
  return order.status === "pending"
    ? paymentStatusLabels[order.paymentStatus] || "Не оплачен"
    : orderStatusLabels[order.status] || "Статус уточняется";
}
