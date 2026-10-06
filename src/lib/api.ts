export async function shopRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok)
    throw new Error(data.error || "Не удалось выполнить запрос");
  return data as T;
}
export interface PaymentResult {
  ok: boolean;
  paymentId: string;
  confirmationUrl: string | null;
  status: string;
  amount: number;
}
export interface PaymentCheck {
  ok: boolean;
  status: "pending" | "succeeded" | "canceled";
  kind: "order" | "subscription";
  orderNumber: string | null;
}
export const PENDING_PAYMENT = "tizavi_pending_payment";
export function openPayment(
  payment: PaymentResult,
  openLink?: (url: string) => void,
) {
  localStorage.setItem(PENDING_PAYMENT, payment.paymentId);
  if (!payment.confirmationUrl) {
    window.location.assign("/payment-return?payment=" + payment.paymentId);
    return;
  }
  if (openLink) openLink(payment.confirmationUrl);
  else window.location.assign(payment.confirmationUrl);
}
