import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import { formatPrice, formatDate, pluralize } from "../utils/format";
import { orderStatusLabel, paymentStatusLabels } from "../utils/orders";
import { useProducts } from "../context/ProductsContext";
import { useState } from "react";
import { CartIcon, HeartIcon, UserIcon, CheckIcon } from "../components/Icons";

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4v4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" strokeLinecap="round" />
    </svg>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { user: account, loading: authLoading } = useAuth();
  const {
    orders,
    wishlist,
    cartCount,
    addToCart,
    ordersLoading,
    ordersError,
    refreshOrders,
  } = useApp();
  const {
    active: subscribed,
    expiresAt,
    priceRub,
    days,
    loading: subLoading,
  } = useSubscription();
  const { products, loading: productsLoading } = useProducts();
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [repeatMessage, setRepeatMessage] = useState("");
  const repeat = (order: (typeof orders)[number]) => {
    let added = 0;
    for (const item of order.items) {
      const product = products.find(
        (p) => p.id === item.product.id && p.inStock,
      );
      if (product) {
        addToCart(product, item.quantity);
        added++;
      }
    }
    const skipped = order.items.length - added;
    setRepeatMessage(
      !added
        ? "Товары этого заказа сейчас недоступны."
        : skipped
          ? `Доступные товары добавлены. ${skipped} позиций сейчас недоступны.`
          : "Товары добавлены по текущим ценам.",
    );
  };
  const visibleOrders = showAllOrders ? orders : orders.slice(0, 3);
  const initials =
    account?.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "Т";
  const scrollToOrders = () =>
    document.getElementById("profile-orders")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });

  return (
    <div className="app-container profile-page profile-studio">
      <header className="profile-page-heading">
        <div>
          <span className="market-eyebrow">Ваше пространство</span>
          <h1>Личный кабинет</h1>
        </div>
        <Link to="/profile/settings" className="profile-settings-link">
          <SettingsIcon />
          <span>Настройки</span>
        </Link>
      </header>
      <main className="scroll-area px-4 profile-layout">
        <section className="profile-welcome" aria-label="Ваш профиль">
          <div className="profile-welcome-copy">
            <span className="profile-welcome-label">
              тизави.рф · с заботой о вашем времени
            </span>
            {authLoading ? (
              <div
                className="profile-name-loading skeleton"
                aria-label="Загружаем профиль"
              />
            ) : (
              <h2>
                {account ? (
                  <>
                    Рады вас видеть,
                    <br />
                    <em>{account.name || "покупатель"}.</em>
                  </>
                ) : (
                  <>
                    Любимые продукты.
                    <br />
                    <em>Всё под рукой.</em>
                  </>
                )}
              </h2>
            )}
            <p>
              {account
                ? "Ваши покупки, любимые продукты и планы на вкусный день."
                : "Войдите, чтобы сохранять историю покупок, повторять заказы и управлять подпиской."}
            </p>
            {!authLoading && (
              <Link
                className="profile-welcome-action"
                to={account ? "/" : "/auth"}
              >
                {account ? "За покупками" : "Войти или зарегистрироваться"}
                <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
          <div className="profile-avatar-scene" aria-hidden="true">
            <div className="profile-avatar-orbit" />
            <div className="profile-avatar">
              {account?.photoUrl ? (
                <img src={account.photoUrl} alt="" />
              ) : account ? (
                initials
              ) : (
                <UserIcon className="w-12 h-12" />
              )}
            </div>
            {account && (
              <span className="profile-avatar-check">
                <CheckIcon className="w-4 h-4" />
              </span>
            )}
          </div>
        </section>
        <div className="profile-summary">
          <section className="profile-quicklinks" aria-label="Ваши покупки">
            {[
              {
                label: "В корзине",
                count: cartCount,
                Icon: CartIcon,
                action: () => navigate("/cart"),
              },
              {
                label: "Избранное",
                count: wishlist.length,
                Icon: HeartIcon,
                action: () => navigate("/wishlist"),
              },
              {
                label: "Заказов",
                count: orders.length,
                Icon: PackageIcon,
                action: scrollToOrders,
              },
            ].map(({ label, count, Icon, action }) => (
              <button key={label} onClick={action}>
                <Icon className="profile-quick-icon" />
                <strong>{count}</strong>
                <span>{label}</span>
                <span className="profile-quick-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </section>
          <section className="profile-membership" aria-label="Подписка">
            <div className="profile-membership-top">
              <span>Ваша подписка</span>
              <span className="profile-membership-symbol" aria-hidden="true">
                {subscribed ? "✓" : "↗"}
              </span>
            </div>
            {subLoading ? (
              <p aria-live="polite">Проверяем подписку…</p>
            ) : (
              <>
                <h2>
                  {subscribed
                    ? "Всё готово\nдля покупок"
                    : "Откройте доступ\nк заказам"}
                </h2>
                <p>
                  {subscribed
                    ? expiresAt
                      ? `Активна до ${formatDate(new Date(expiresAt).getTime())}`
                      : "Ваша подписка активна"
                    : `${formatPrice(priceRub)} на ${days} дней. Подписка нужна для оформления заказов.`}
                </p>
                <Link to="/subscribe">
                  {subscribed ? "Управлять подпиской" : "Оформить подписку"}
                  <span aria-hidden="true">→</span>
                </Link>
              </>
            )}
          </section>
        </div>
        <section id="profile-orders" className="profile-orders">
          <div className="profile-orders-heading">
            <div>
              <span className="market-eyebrow">История покупок</span>
              <h2>
                Мои заказы <span>{orders.length}</span>
              </h2>
            </div>
            {orders.length > 3 && (
              <button onClick={() => setShowAllOrders((s) => !s)}>
                {showAllOrders ? "Свернуть" : "Показать все"}{" "}
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
          {repeatMessage && (
            <p role="status" className="profile-feedback">
              {repeatMessage} <Link to="/cart">В корзину →</Link>
            </p>
          )}
          {ordersError && (
            <p role="alert" className="profile-feedback profile-feedback-error">
              {ordersError}{" "}
              <button onClick={() => void refreshOrders().catch(() => {})}>
                Повторить загрузку
              </button>
            </p>
          )}
          {ordersLoading && !orders.length ? (
            <div className="profile-orders-loading" aria-live="polite">
              <span>Загружаем заказы…</span>
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : visibleOrders.length ? (
            <div className="profile-order-list">
              {visibleOrders.map((order) => (
                <article key={order.id} className="profile-order-card">
                  <div className="profile-order-top">
                    <div>
                      <h3>{order.id}</h3>
                      <p>{formatDate(order.createdAt)}</p>
                    </div>
                    <span
                      className={`profile-order-status profile-order-status-${order.status === "pending" ? order.paymentStatus : order.status}`}
                    >
                      {orderStatusLabel(order)}
                    </span>
                  </div>
                  <div className="profile-order-products">
                    {order.items.slice(0, 4).map(({ product }) => (
                      <img
                        key={product.id}
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    ))}
                    {order.items.length > 4 && (
                      <span>+{order.items.length - 4}</span>
                    )}
                    <div className="profile-order-amount">
                      <strong>{formatPrice(order.payableTotal)}</strong>
                      <span>
                        {order.items.length}{" "}
                        {pluralize(order.items.length, [
                          "позиция",
                          "позиции",
                          "позиций",
                        ])}
                      </span>
                    </div>
                  </div>
                  <div className="profile-order-bottom">
                    <span
                      className={`profile-payment profile-payment-${order.paymentStatus}`}
                    >
                      {paymentStatusLabels[order.paymentStatus]}
                    </span>
                    <div>
                      <Link to={`/order-success/${order.id}`}>Подробнее</Link>
                      <button
                        disabled={productsLoading}
                        onClick={() => repeat(order)}
                      >
                        Повторить <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !ordersError && (
              <div className="profile-empty-orders">
                <div className="profile-empty-art">
                  <PackageIcon />
                </div>
                <span className="market-eyebrow">
                  Всё начинается с первого заказа
                </span>
                <h3>
                  {!account && !authLoading
                    ? "Здесь будет ваша история"
                    : "Что-нибудь вкусное?"}
                </h3>
                <p>
                  {!account && !authLoading
                    ? "Войдите в аккаунт — и ваши заказы будут доступны в одном месте."
                    : "Выберите продукты в каталоге. После оформления заказ появится здесь, и его можно будет легко повторить."}
                </p>
                <Link to={!account && !authLoading ? "/auth" : "/"}>
                  {!account && !authLoading
                    ? "Войти в аккаунт"
                    : "Открыть каталог"}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            )
          )}
        </section>
        <section className="profile-links">
          <Link to="/support" className="profile-help">
            <span className="market-eyebrow">Рядом, если нужно</span>
            <h2>
              Поможем разобраться <span aria-hidden="true">↗</span>
            </h2>
            <p>Вопросы о заказах, доставке или подписке.</p>
          </Link>
          <div className="profile-documents">
            {account?.telegramId && (
              <Link to="/admin">
                Панель сотрудников <span aria-hidden="true">↗</span>
              </Link>
            )}
            <Link to="/profile/privacy">
              Мои персональные данные <span aria-hidden="true">↗</span>
            </Link>
            {[
              ["offer", "Договор-оферта"],
              ["privacy", "Конфиденциальность"],
              ["terms", "Пользовательское соглашение"],
            ].map(([id, label]) => (
              <Link key={id} to={`/legal/${id}`}>
                {label}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <p className="profile-footer">
          тизави.рф <span>Для ваших вкусных дней</span>
        </p>
      </main>
    </div>
  );
}
