import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTelegram } from "../lib/telegram";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import { PENDING_PAYMENT, shopRequest, type PaymentCheck } from "../lib/api";
export function PaymentReturn() {
  const { user: account, loading: authLoading } = useAuth();
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    { webApp } = useTelegram(),
    { refreshOrders, settleOrder } = useApp(),
    { refresh } = useSubscription();
  const [message, setMessage] = useState("Проверяем оплату…"),
    [busy, setBusy] = useState(false);
  const paymentId =
    params.get("payment") || localStorage.getItem(PENDING_PAYMENT);
  const check = async () => {
    if (!paymentId)
      return setMessage("Платёж не найден. Откройте историю заказов.");
    if (!account || authLoading)
      return setMessage(
        "Войдите в аккаунт, в котором начали оплату. Повторно платить не нужно.",
      );
    setBusy(true);
    try {
      const data = await shopRequest<PaymentCheck>("/api/payments", {
        action: "status",
        paymentId,
        initData: webApp?.initData,
      });
      if (data.status === "pending")
        setMessage("Оплата ещё обрабатывается. Подождите и проверьте снова.");
      else if (data.status === "canceled") {
        if (localStorage.getItem(PENDING_PAYMENT) === paymentId)
          localStorage.removeItem(PENDING_PAYMENT);
        if (data.kind === "subscription")
          localStorage.removeItem("tizavi_subscription_request");
        setMessage("Оплата отменена. Товары остались в корзине.");
      } else {
        if (data.kind === "subscription") {
          localStorage.removeItem("tizavi_subscription_request");
          await refresh();
          navigate("/subscribe", { replace: true });
        } else {
          const orders = await refreshOrders(),
            order = orders.find((o) => o.id === data.orderNumber);
          if (!order)
            throw new Error("Оплата подтверждена. Обновите историю заказов.");
          settleOrder(order);
          navigate(`/order-success/${order.id}`, { replace: true });
        }
        if (localStorage.getItem(PENDING_PAYMENT) === paymentId)
          localStorage.removeItem(PENDING_PAYMENT);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Не удалось проверить оплату",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void check();
  }, [paymentId, webApp, account?.id, authLoading]);
  return (
    <div className="app-container px-4 pt-8">
      <h1 className="text-xl font-bold mb-4">Оплата</h1>
      <p className="text-sm mb-4">{message}</p>
      {account ? (
        <button
          disabled={busy}
          onClick={() => void check()}
          className="btn-primary"
        >
          Проверить оплату
        </button>
      ) : (
        <button
          onClick={() =>
            navigate(
              "/auth?next=" +
                encodeURIComponent(
                  "/payment-return?payment=" + (paymentId || ""),
                ),
            )
          }
          className="btn-primary"
        >
          Войти в аккаунт
        </button>
      )}
      <button
        onClick={() => navigate("/profile")}
        className="btn-secondary mt-3"
      >
        Мои заказы
      </button>
    </div>
  );
}
