import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useTelegram } from "../lib/telegram";
import { PENDING_PAYMENT, shopRequest, type PaymentCheck } from "../lib/api";
export function PaymentMonitor() {
  const { webApp } = useTelegram(),
    { refreshOrders, settleOrder } = useApp(),
    { refresh } = useSubscription();
  const navigate = useNavigate();
  const check = useCallback(async () => {
    const paymentId = localStorage.getItem(PENDING_PAYMENT);
    if (!paymentId || !webApp?.initData) return;
    try {
      const result = await shopRequest<PaymentCheck>("/api/payments", {
        action: "status",
        paymentId,
        initData: webApp.initData,
      });
      if (result.status === "pending") return;
      if (result.status === "succeeded") {
        if (result.kind === "subscription") {
          localStorage.removeItem("tizavi_subscription_request");
          await refresh();
          navigate("/subscribe");
        } else {
          const orders = await refreshOrders();
          const order = orders.find((o) => o.id === result.orderNumber);
          if (!order) return;
          settleOrder(order);
          navigate(`/order-success/${order.id}`);
        }
      }
      if (result.kind === "subscription" && result.status === "canceled")
        localStorage.removeItem("tizavi_subscription_request");
      if (localStorage.getItem(PENDING_PAYMENT) === paymentId)
        localStorage.removeItem(PENDING_PAYMENT);
    } catch {
      /* Retain the payment ID and basket until the server can confirm the payment. */
    }
  }, [webApp, refreshOrders, settleOrder, refresh, navigate]);
  useEffect(() => {
    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 8000);
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
    };
  }, [check]);
  return null;
}
