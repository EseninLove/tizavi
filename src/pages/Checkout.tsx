import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useDelivery } from "../context/DeliveryContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useTelegram } from "../lib/telegram";
import { formatPrice, formatQuantity } from "../utils/format";
import { shopRequest, openPayment, type PaymentResult } from "../lib/api";
import { DeliveryAddress, deliveryWindow } from "../components/DeliveryAddress";
import { EmptyState } from "../components/EmptyState";
import type { Order } from "../types";
export function Checkout() {
  const navigate = useNavigate(),
    { cart, cartTotal, placeOrder } = useApp(),
    { quote } = useDelivery(),
    { active, loading } = useSubscription(),
    { user, webApp } = useTelegram();
  const [name, setName] = useState(user?.first_name || ""),
    [phone, setPhone] = useState(""),
    [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [draft, setDraft] = useState<Order | null>(null);
  useEffect(() => {
    if (user?.first_name) setName((n) => n || user.first_name);
  }, [user]);
  useEffect(() => setDraft(null), [cart, name, phone, comment, quote]);
  const valid = !!quote && !!name.trim() && /^\+?[\d\s()-]{10,25}$/.test(phone);
  const submit = async () => {
    if (!valid || busy || !quote) return;
    setBusy(true);
    setError("");
    try {
      if (!draft) {
        setDraft(
          await placeOrder(
            {
              name,
              phone,
              comment,
              address: quote.address,
              city: quote.city,
              addressId: quote.addressId,
              deliveryType: "courier",
            },
            "aggregator",
          ),
        );
      } else {
        if (draft.paymentStatus === "succeeded") {
          navigate(`/order-success/${draft.id}`);
          return;
        }
        const payment = await shopRequest<PaymentResult>("/api/payments", {
          initData: webApp?.initData,
          kind: "order",
          orderNumber: draft.id,
          requestKey: crypto.randomUUID(),
        });
        openPayment(payment, webApp?.openLink?.bind(webApp));
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось оформить заказ. Корзина сохранена.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!cart.length)
    return (
      <div className="app-container">
        <EmptyState
          icon="🛒"
          title="Корзина пуста"
          description="Добавьте товары для заказа"
          actionLabel="В каталог"
          onAction={() => navigate("/")}
        />
      </div>
    );
  if (loading)
    return <div className="app-container p-4">Проверяем подписку…</div>;
  if (!active)
    return (
      <div className="app-container">
        <EmptyState
          icon="💳"
          title="Нужна подписка"
          description="Оформление заказов доступно с активной подпиской."
          actionLabel="Оформить подписку"
          onAction={() => navigate("/subscribe")}
        />
      </div>
    );
  return (
    <div className="app-container">
      <header className="p-4">
        <button
          onClick={() => navigate("/cart")}
          className="text-sm text-tg-link mb-2"
        >
          ← Корзина
        </button>
        <h1 className="text-xl font-bold">Оформление заказа</h1>
      </header>
      <main className="scroll-area px-4 space-y-4 checkout-content">
        <DeliveryAddress />
        {quote && (
          <p className="text-xs text-tg-hint">
            Курьер · ориентировочно {deliveryWindow(quote)}
          </p>
        )}
        <section className="section-card p-4 space-y-3">
          <h2 className="font-semibold text-sm">Контакты</h2>
          <label className="block text-xs text-tg-hint">
            Имя
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              autoComplete="name"
              maxLength={100}
            />
          </label>
          <label className="block text-xs text-tg-hint">
            Телефон
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="input mt-1"
            />
          </label>
          <label className="block text-xs text-tg-hint">
            Квартира, подъезд, домофон и комментарий
            <textarea
              className="input mt-1"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </label>
        </section>
        <section className="section-card p-4 space-y-2">
          <h2 className="font-semibold text-sm">
            {draft ? "Проверьте заказ перед оплатой" : "Ваш заказ"}
          </h2>
          {(draft?.items || cart).map((i) => (
            <div
              key={i.product.id}
              className="flex justify-between gap-3 text-sm"
            >
              <span>
                {i.product.name} · {formatQuantity(i.quantity)}{" "}
                {i.product.unit || "шт"}
              </span>
              <span className="whitespace-nowrap">
                {formatPrice(i.product.price * i.quantity)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-3 border-t border-tg-separator">
            <span>Товары</span>
            <span>{formatPrice(draft?.total ?? cartTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Доставка</span>
            <span>
              {draft
                ? draft.deliveryFee === 0
                  ? "Бесплатно"
                  : formatPrice(draft.deliveryFee)
                : "Рассчитаем при продолжении"}
            </span>
          </div>
          {draft && (
            <div className="flex justify-between font-bold">
              <span>К оплате</span>
              <span>{formatPrice(draft.payableTotal)}</span>
            </div>
          )}
        </section>
        <section className="section-card p-4 text-sm">
          💳 Оплата на защищённой странице платёжного сервиса. Подтверждение
          появится в магазине после проверки платежа.
        </section>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-500 rounded-xl bg-red-500/10 p-3"
          >
            {error}
          </p>
        )}
        {draft && (
          <p className="text-xs text-tg-hint">
            Заказ {draft.id} сохранён и ожидает оплаты. Сумма учитывает
            актуальные цены и адрес доставки.
          </p>
        )}
      </main>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-tg-section-bg safe-bottom">
        <button
          className="btn-primary w-full"
          disabled={!valid || busy}
          onClick={() => void submit()}
        >
          {busy
            ? "Подождите…"
            : draft
              ? `Оплатить · ${formatPrice(draft.payableTotal)}`
              : "Продолжить"}
        </button>
      </div>
    </div>
  );
}
