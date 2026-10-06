import { useCallback, useEffect, useState } from "react";
import { Routes, Route, NavLink, useLocation, Link } from "react-router-dom";
import { authApi, apiFetch } from "./api";
import { AdminLogin } from "./AdminLogin";
import { Dashboard } from "./Dashboard";
import { ProductsAdmin } from "./ProductsAdmin";
import { OrdersAdmin } from "./OrdersAdmin";
import { UsersAdmin } from "./UsersAdmin";
import { AdminsAdmin } from "./AdminsAdmin";
import { CategoriesAdmin } from "./CategoriesAdmin";
import { SupportAdmin } from "./SupportAdmin";
import { PaymentsAdmin } from "./PaymentsAdmin";
import { DeliveryAdmin } from "./DeliveryAdmin";
import { ReviewsAdmin } from "./ReviewsAdmin";
import { Settings } from "./Settings";
import { AdminIcon } from "./AdminUI";
import "./admin.css";

const groups = [
  {
    label: "Работа",
    items: [
      { path: "/admin", label: "Обзор", icon: "home" },
      {
        path: "/admin/orders",
        label: "Заказы",
        icon: "orders",
        badge: "orders",
      },
      { path: "/admin/users", label: "Покупатели", icon: "users" },
      {
        path: "/admin/support",
        label: "Поддержка",
        icon: "support",
        badge: "support",
      },
    ],
  },
  {
    label: "Каталог",
    items: [
      { path: "/admin/products", label: "Товары", icon: "products" },
      { path: "/admin/categories", label: "Категории", icon: "categories" },
      {
        path: "/admin/reviews",
        label: "Отзывы",
        icon: "reviews",
        badge: "reviews",
      },
    ],
  },
  {
    label: "Настройки",
    items: [
      {
        path: "/admin/payments",
        label: "Оплата",
        icon: "payments",
        owner: true,
      },
      { path: "/admin/delivery", label: "Доставка", icon: "delivery" },
      {
        path: "/admin/admins",
        label: "Сотрудники",
        icon: "shield",
        owner: true,
      },
      { path: "/admin/settings", label: "Настройки", icon: "settings" },
    ],
  },
];
export function AdminApp() {
  const [authed, setAuthed] = useState(authApi.isAuthed()),
    [menu, setMenu] = useState(false),
    [counts, setCounts] = useState<Record<string, number>>({});
  const location = useLocation();
  const owner = authApi.role() === "super_admin";
  const logout = useCallback(() => {
    authApi.logout();
    setAuthed(false);
    setMenu(false);
  }, []);
  useEffect(() => {
    const handler = () => setAuthed(false);
    window.addEventListener("tizavi-admin-expired", handler);
    return () => window.removeEventListener("tizavi-admin-expired", handler);
  }, []);
  useEffect(() => {
    setMenu(false);
    if (authed)
      apiFetch("/api/dashboard")
        .then((d) => {
          if (d.ok)
            setCounts(
              d.attention || {
                orders: Number(d.stats?.statusCounts?.paid || 0),
              },
            );
        })
        .catch(() => {});
  }, [location.pathname, authed]);
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", fn);
    };
  }, [menu]);
  if (!authed)
    return (
      <div className="admin-root">
        <AdminLogin onLogin={() => setAuthed(true)} />
      </div>
    );
  const current = groups
    .flatMap((g) => g.items)
    .find((i) => i.path === location.pathname);
  return (
    <div className="admin-root">
      <div className="admin-mobile-header">
        <strong>Tizavi</strong>
        <button
          className="admin-icon-button"
          aria-label="Открыть меню администратора"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <AdminIcon name="menu" />
        </button>
      </div>
      {menu && (
        <button
          className="admin-nav-overlay"
          onClick={() => setMenu(false)}
          aria-label="Закрыть меню"
        />
      )}
      <aside
        className={`admin-sidebar ${menu ? "open" : ""}`}
        aria-label="Навигация администратора"
      >
        <div className="admin-brand">
          <strong>Tizavi</strong>
          <span>Управление магазином</span>
          {menu && (
            <button
              onClick={() => setMenu(false)}
              className="admin-icon-button absolute right-2 top-4"
              aria-label="Закрыть навигацию"
            >
              <AdminIcon name="close" />
            </button>
          )}
        </div>
        <nav>
          {groups.map((g) => (
            <div key={g.label}>
              <div className="admin-nav-group">{g.label}</div>
              {g.items
                .filter((i) => !("owner" in i && i.owner && !owner))
                .map((i) => (
                  <NavLink
                    key={i.path}
                    to={i.path}
                    end={i.path === "/admin"}
                    className={({ isActive }) =>
                      `admin-nav-link ${isActive ? "active" : ""}`
                    }
                  >
                    <AdminIcon name={i.icon} />
                    {i.label}
                    {"badge" in i && Number(counts[String(i.badge)]) > 0 && (
                      <span className="admin-nav-count">
                        {counts[String(i.badge)]}
                      </span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/">
            <AdminIcon name="external" />
            Открыть магазин
          </Link>
          <button onClick={logout}>
            <AdminIcon name="logout" />
            {owner ? "Владелец" : "Администратор"} · Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <span>Управление / {current?.label || "Обзор"}</span>
          <Link to="/">
            <AdminIcon name="external" className="w-3 h-3" />
            Открыть магазин
          </Link>
        </div>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="support" element={<SupportAdmin />} />
          <Route path="admins" element={<AdminsAdmin />} />
          <Route path="payments" element={<PaymentsAdmin />} />
          <Route path="delivery" element={<DeliveryAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
      <nav className="admin-mobile-shortcuts" aria-label="Быстрые разделы">
        {[
          { path: "orders", label: "Заказы", icon: "orders" },
          { path: "products", label: "Товары", icon: "products" },
          { path: "support", label: "Поддержка", icon: "support" },
        ].map((i) => (
          <NavLink
            key={i.path}
            to={`/admin/${i.path}`}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <AdminIcon name={i.icon} />
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
