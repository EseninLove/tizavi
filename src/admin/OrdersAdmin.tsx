import { useCallback, useEffect, useState } from "react";
import { ordersApi } from "./api";
import { formatPrice } from "../utils/format";
import {
  AdminHeader,
  AdminSearch,
  AdminTabs,
  AdminNotice,
  AdminEmpty,
  AdminDetail,
  AdminBadge,
  AdminPager,
  AdminIcon,
  adminDate,
  moscowDay,
} from "./AdminUI";
const statuses: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "В обработке",
  shipped: "В доставке",
  delivered: "Доставлен",
  cancelled: "Отменён",
};
const payments: Record<string, string> = {
  pending: "Не оплачен",
  succeeded: "Оплачен",
  canceled: "Оплата отменена",
  unverified: "Требует проверки",
};
const paymentTone = (s: string) =>
  s === "succeeded" ? "success" : s === "canceled" ? "danger" : "warning";
const statusTone = (s: string) =>
  s === "delivered"
    ? "success"
    : s === "shipped"
      ? "info"
      : s === "cancelled"
        ? "danger"
        : "neutral";
interface OrderRow {
  id: number;
  order_number: string;
  items: Array<{
    product_id: string;
    product: { name: string; image: string; price: number; unit?: string };
    lineTotalMinor?: number;
    quantity: number;
  }>;
  total: number;
  payable_total: number;
  delivery_fee: number;
  payment_status: string;
  delivery: {
    name: string;
    phone: string;
    address: string;
    city: string;
    comment?: string;
    deliveryType: string;
  };
  payment_method: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  created_at: string;
}

export function OrdersAdmin() {
  const [orders, setOrders] = useState<OrderRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [payment, setPayment] = useState("all"),
    [day, setDay] = useState(""),
    [page, setPage] = useState(1),
    [selectedId, setSelectedId] = useState<number | null>(null),
    [tab, setTab] = useState("items"),
    [busy, setBusy] = useState(false);
  const close = useCallback(() => setSelectedId(null), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await ordersApi.list();
      if (!r.ok) throw new Error(r.error);
      setOrders(r.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(1), [search, filter, payment, day]);
  const selected = orders.find((o) => o.id === selectedId),
    today = moscowDay(new Date());
  const filtered = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (payment === "all" || o.payment_status === payment) &&
      (!day || moscowDay(o.created_at) === day) &&
      [
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.delivery?.name,
        o.delivery?.phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, pages),
    visible = filtered.slice((current - 1) * 20, current * 20);
  const update = async (status: string) => {
    if (!selected || busy) return;
    if (
      status === "cancelled" &&
      !window.confirm(
        "Отменить заказ? Возврат оплаченных средств необходимо оформить отдельно у платёжного сервиса.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await ordersApi.updateStatus(selected.id, status);
      if (!r.ok) throw new Error(r.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить заказ");
    } finally {
      setBusy(false);
    }
  };
  const open = (id: number) => {
    setSelectedId(id);
    setTab("items");
  };
  return (
    <div>
      <AdminHeader
        title="Заказы"
        subtitle="Оплата, сборка и доставка — в одном месте"
      >
        <button
          className="admin-button"
          onClick={() => void load()}
          disabled={loading}
        >
          <AdminIcon name="refresh" />
          Обновить
        </button>
      </AdminHeader>
      <div className="admin-stats">
        {[
          {
            label: "Заказов сегодня",
            value: orders.filter((o) => moscowDay(o.created_at) === today)
              .length,
            icon: "orders",
          },
          {
            label: "Ждут обработки",
            value: orders.filter(
              (o) => o.status === "paid" && o.payment_status === "succeeded",
            ).length,
            icon: "check",
          },
          {
            label: "Не оплачены",
            value: orders.filter(
              (o) => o.payment_status === "pending" && o.status !== "cancelled",
            ).length,
            icon: "clock",
          },
          {
            label: "В доставке",
            value: orders.filter((o) => o.status === "shipped").length,
            icon: "delivery",
          },
        ].map((x) => (
          <div key={x.label} className="admin-stat">
            <div className="admin-stat-icon">
              <AdminIcon name={x.icon} />
            </div>
            <div>
              <small>{x.label}</small>
              <strong>{x.value}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="admin-toolbar">
        <AdminSearch
          value={search}
          onChange={setSearch}
          placeholder="Номер заказа, покупатель или телефон"
        />
        <input
          className="admin-input"
          style={{ width: 160 }}
          type="date"
          aria-label="Дата заказа по Москве"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <select
          className="admin-input"
          style={{ width: 180 }}
          aria-label="Статус оплаты"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        >
          <option value="all">Любая оплата</option>
          {Object.entries(payments).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {(day || payment !== "all" || search || filter !== "all") && (
          <button
            className="admin-button"
            onClick={() => {
              setDay("");
              setPayment("all");
              setSearch("");
              setFilter("all");
            }}
          >
            Сбросить
          </button>
        )}
      </div>
      <AdminTabs
        tabs={[
          { id: "all", label: "Все", count: orders.length },
          ...Object.entries(statuses).map(([id, label]) => ({
            id,
            label,
            count: orders.filter((o) => o.status === id).length,
          })),
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error && <AdminNotice>{error}</AdminNotice>}
      <div className={`admin-split ${selected ? "has-detail" : ""}`}>
        <div>
          {loading ? (
            <AdminEmpty title="Загрузка заказов…" />
          ) : !filtered.length ? (
            <AdminEmpty
              title="Заказов не найдено"
              description="Измените поиск или фильтры"
            />
          ) : (
            <>
              <div className="admin-table-wrap admin-order-desktop">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {[
                        "Заказ",
                        "Покупатель",
                        "Сумма",
                        "Оплата",
                        "Доставка",
                        "",
                      ].map((x, i) => (
                        <th key={i}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((o) => (
                      <tr
                        key={o.id}
                        className={o.id === selectedId ? "selected" : ""}
                      >
                        <td>
                          <button
                            className="admin-order-open"
                            onClick={() => open(o.id)}
                          >
                            {o.order_number}
                            <span>{adminDate(o.created_at)}</span>
                          </button>
                        </td>
                        <td>
                          {o.customer_name || o.delivery?.name || "Гость"}
                          <div className="admin-hint">
                            {o.items?.length || 0} позиций
                          </div>
                        </td>
                        <td className="admin-money">
                          {formatPrice(Number(o.payable_total))}
                        </td>
                        <td>
                          <AdminBadge tone={paymentTone(o.payment_status)}>
                            {payments[o.payment_status] || "Неизвестно"}
                          </AdminBadge>
                        </td>
                        <td>
                          <AdminBadge tone={statusTone(o.status)}>
                            {statuses[o.status] || o.status}
                          </AdminBadge>
                        </td>
                        <td>
                          <button
                            className="admin-icon-button"
                            aria-label={`Открыть заказ ${o.order_number}`}
                            onClick={() => open(o.id)}
                          >
                            <AdminIcon name="chevron" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-mobile-orders">
                {visible.map((o) => (
                  <button
                    className={`admin-order-mobile ${o.id === selectedId ? "selected" : ""}`}
                    key={o.id}
                    onClick={() => open(o.id)}
                  >
                    <div>
                      <strong>{o.order_number}</strong>
                      <strong>{formatPrice(Number(o.payable_total))}</strong>
                    </div>
                    <div>
                      {o.customer_name || o.delivery?.name || "Гость"}
                      <small>{adminDate(o.created_at)}</small>
                    </div>
                    <div>
                      <AdminBadge tone={paymentTone(o.payment_status)}>
                        {payments[o.payment_status] || "Неизвестно"}
                      </AdminBadge>
                      <AdminBadge tone={statusTone(o.status)}>
                        {statuses[o.status] || o.status}
                      </AdminBadge>
                    </div>
                  </button>
                ))}
              </div>
              <AdminPager
                page={current}
                pages={pages}
                total={filtered.length}
                onChange={setPage}
              />
            </>
          )}
        </div>
        {selected && (
          <AdminDetail
            title={selected.order_number}
            onClose={close}
            footer={
              <>
                {selected.payment_status === "succeeded" &&
                ["paid", "shipped"].includes(selected.status) ? (
                  <button
                    className="admin-primary"
                    disabled={busy}
                    onClick={() =>
                      void update(
                        selected.status === "paid" ? "shipped" : "delivered",
                      )
                    }
                  >
                    {busy
                      ? "Сохраняем…"
                      : selected.status === "paid"
                        ? "Передать в доставку"
                        : "Отметить доставленным"}
                  </button>
                ) : (
                  <p className="admin-detail-action-note">
                    {selected.status === "cancelled"
                      ? "Заказ отменён"
                      : selected.status === "delivered"
                        ? "Заказ доставлен"
                        : "Доставка доступна после подтверждения оплаты сервером"}
                  </p>
                )}
                {!["cancelled", "delivered"].includes(selected.status) && (
                  <details className="admin-secondary-actions">
                    <summary>Другие действия</summary>
                    <button
                      className="admin-button admin-danger"
                      disabled={busy}
                      onClick={() => void update("cancelled")}
                    >
                      Отменить заказ
                    </button>
                  </details>
                )}
              </>
            }
          >
            <div className="admin-row-actions" style={{ marginBottom: 16 }}>
              <AdminBadge tone={paymentTone(selected.payment_status)}>
                {payments[selected.payment_status] || "Неизвестно"}
              </AdminBadge>
              <AdminBadge tone={statusTone(selected.status)}>
                {statuses[selected.status]}
              </AdminBadge>
            </div>
            {error && <AdminNotice>{error}</AdminNotice>}
            <AdminTabs
              tabs={[
                { id: "items", label: "Состав" },
                { id: "delivery", label: "Доставка" },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "items" ? (
              <>
                <section className="admin-detail-section">
                  <h3>Товары · {selected.items?.length || 0} позиций</h3>
                  {selected.items?.map((i, n) => (
                    <div className="admin-detail-item" key={n}>
                      {i.product?.image && <img src={i.product.image} alt="" />}
                      <div>
                        {i.product?.name || "Товар"}
                        <small>
                          {i.quantity} {i.product?.unit || "шт"}
                        </small>
                      </div>
                      <strong>
                        {formatPrice(
                          i.lineTotalMinor !== undefined
                            ? i.lineTotalMinor / 100
                            : Number(i.product?.price || 0) * i.quantity,
                        )}
                      </strong>
                    </div>
                  ))}
                </section>
                <section className="admin-detail-section admin-breakdown">
                  <div>
                    <span>Товары</span>
                    <strong>{formatPrice(Number(selected.total))}</strong>
                  </div>
                  <div>
                    <span>Доставка</span>
                    <strong>
                      {formatPrice(Number(selected.delivery_fee || 0))}
                    </strong>
                  </div>
                  <div className="total">
                    <span>Итого</span>
                    <strong>
                      {formatPrice(Number(selected.payable_total))}
                    </strong>
                  </div>
                </section>
              </>
            ) : (
              <section className="admin-detail-section">
                <h3>Получатель</h3>
                <p>{selected.delivery?.name || selected.customer_name}</p>
                <p>{selected.delivery?.phone || selected.customer_phone}</p>
                <h3 style={{ marginTop: 20 }}>Способ получения</h3>
                <p>
                  {selected.delivery?.deliveryType === "pickup"
                    ? "Самовывоз"
                    : [selected.delivery?.city, selected.delivery?.address]
                        .filter(Boolean)
                        .join(", ")}
                </p>
                {selected.delivery?.comment && (
                  <>
                    <h3 style={{ marginTop: 20 }}>Комментарий покупателя</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {selected.delivery.comment}
                    </p>
                  </>
                )}
              </section>
            )}
            <p className="admin-hint">
              Создан {adminDate(selected.created_at)}
            </p>
          </AdminDetail>
        )}
      </div>
    </div>
  );
}
