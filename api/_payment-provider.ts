import crypto from "node:crypto";
import { paymentConfiguration, ProviderName } from "./_payment-config.js";
import { ShopError } from "./_commerce.js";
export function tbankToken(body: Record<string, unknown>, password: string) {
  const values: Record<string, unknown> = { ...body, Password: password };
  delete values.Token;
  return crypto
    .createHash("sha256")
    .update(
      Object.keys(values)
        .filter((k) => values[k] !== null && typeof values[k] !== "object")
        .sort()
        .map((k) => String(values[k]))
        .join(""),
    )
    .digest("hex");
}
async function call(
  url: string,
  headers: Record<string, string>,
  body?: Record<string, unknown>,
  allowFailure = false,
) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    signal: AbortSignal.timeout(15000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await response.json()) as Record<string, any>;
  if (!response.ok || (!allowFailure && data.Success === false))
    throw new ShopError(
      "Платёжный сервис временно недоступен. Повторите попытку.",
      502,
    );
  return data;
}
export async function providerCreate(
  intent: Record<string, any>,
  description: string,
) {
  const config = await paymentConfiguration(
    intent.provider_name as ProviderName,
  );
  if (!config.configured) throw new ShopError("Оплата пока не подключена", 503);
  const returnUrl = new URL("/payment-return", config.publicUrl);
  returnUrl.searchParams.set("payment", intent.id);
  if (config.name === "yookassa") {
    const data = await call(
      "https://api.yookassa.ru/v3/payments",
      {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(
            `${config.credentials.shopId}:${config.credentials.secretKey}`,
          ).toString("base64"),
        "Idempotence-Key": intent.id,
      },
      {
        amount: {
          value: (Number(intent.amount_minor) / 100).toFixed(2),
          currency: "RUB",
        },
        capture: true,
        confirmation: { type: "redirect", return_url: returnUrl.toString() },
        description,
        metadata: { intent_id: intent.id },
      },
    );
    return { providerId: data.id, url: data.confirmation?.confirmation_url };
  }
  const check = {
    TerminalKey: config.credentials.terminalKey,
    OrderId: intent.id,
  };
  const existing = await call(
    "https://securepay.tinkoff.ru/v2/CheckOrder",
    { "Content-Type": "application/json" },
    { ...check, Token: tbankToken(check, config.credentials.password) },
    true,
  );
  if (existing.Success && existing.Payments?.length) {
    const payment = existing.Payments.find(
      (p: Record<string, any>) =>
        !["REJECTED", "CANCELED", "DEADLINE_EXPIRED"].includes(p.Status),
    );
    if (payment) return { providerId: String(payment.PaymentId), url: null };
  }
  const body = {
    TerminalKey: config.credentials.terminalKey,
    Amount: Number(intent.amount_minor),
    OrderId: intent.id,
    Description: description,
    SuccessURL: returnUrl.toString(),
    FailURL: returnUrl.toString(),
    NotificationURL: new URL(
      "/api/payment-webhook",
      config.publicUrl,
    ).toString(),
    PayType: "O",
  };
  const data = await call(
    "https://securepay.tinkoff.ru/v2/Init",
    { "Content-Type": "application/json" },
    { ...body, Token: tbankToken(body, config.credentials.password) },
  );
  return { providerId: String(data.PaymentId), url: data.PaymentURL };
}
export async function providerStatus(
  intent: Record<string, any>,
): Promise<Record<string, any>> {
  const config = await paymentConfiguration(
    intent.provider_name as ProviderName,
  );
  if (!config.configured)
    throw new ShopError("Платёжный сервис не настроен", 503);
  if (config.name === "yookassa") {
    const data = await call(
      "https://api.yookassa.ru/v3/payments/" +
        encodeURIComponent(intent.provider_id),
      {
        Authorization:
          "Basic " +
          Buffer.from(
            `${config.credentials.shopId}:${config.credentials.secretKey}`,
          ).toString("base64"),
      },
    );
    return { ...data, allowTest: config.allowTest };
  }
  const body = {
    TerminalKey: config.credentials.terminalKey,
    PaymentId: intent.provider_id,
  };
  const data = await call(
    "https://securepay.tinkoff.ru/v2/GetState",
    { "Content-Type": "application/json" },
    { ...body, Token: tbankToken(body, config.credentials.password) },
  );
  const check = {
    TerminalKey: config.credentials.terminalKey,
    OrderId: intent.id,
  };
  const order = await call(
    "https://securepay.tinkoff.ru/v2/CheckOrder",
    { "Content-Type": "application/json" },
    { ...check, Token: tbankToken(check, config.credentials.password) },
  );
  const belongs =
    order.OrderId === intent.id &&
    order.Payments?.some(
      (p: Record<string, any>) =>
        String(p.PaymentId) === String(intent.provider_id),
    );
  return {
    id: String(data.PaymentId),
    amount: { currency: "RUB", value: (Number(data.Amount) / 100).toFixed(2) },
    metadata: { intent_id: belongs ? intent.id : null },
    paid: data.Status === "CONFIRMED",
    status:
      data.Status === "CONFIRMED"
        ? "succeeded"
        : ["REJECTED", "CANCELED", "DEADLINE_EXPIRED"].includes(data.Status)
          ? "canceled"
          : "pending",
    allowTest: config.allowTest,
  };
}
