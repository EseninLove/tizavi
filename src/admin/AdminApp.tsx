import { staffPageAllowed, staffHome, staffRoleLabel } from "../shared/staff";
import { PrivacyAdmin } from "./PrivacyAdmin";
import { EmailSettingsAdmin } from "./EmailSettingsAdmin";
import { useCallback, useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  useLocation,
  Link,
  Navigate,
} from "react-router-dom";
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
        path: "/admin/privacy",
        label: "Персональные данные",
        icon: "shield",
        owner: true,
      },
      {
        path: "/admin/email",
        label: "Почтовый сервис",
        icon: "support",
        owner: true,
      },
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
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false),
    [menu, setMenu] = useState(false),
    [counts, setCounts] = useState<Record<string, number>>({});
  const location = useLocation();
  const role = authApi.role();
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => staffPageAllowed(role, i.path)),
    }))
    .filter((g) => g.items.length);
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      setAuthed(false);
      setMenu(false);
    } catch {
      window.alert(
        "Не удалось выйти. Проверьте соединение и повторите попытку.",
      );
    }
  }, []);
  useEffect(() => {
    let live = true;
    authApi
      .restore()
      .then((value) => {
        if (live) setAuthed(value);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const handler = () => setAuthed(false);
    window.addEventListener("tizavi-admin-expired", handler);
    return () => window.removeEventListener("tizavi-admin-expired", handler);
  }, []);
  useEffect(() => {
    setMenu(false);
    if (authed && staffPageAllowed(role, "/admin"))
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
  }, [location.pathname, authed, role]);
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
  if (checking) return <div className="admin-root p-6">Проверяем вход…</div>;
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
          {visibleGroups.map((g) => (
            <div key={g.label}>
              <div className="admin-nav-group">{g.label}</div>
              {g.items.map((i) => (
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
            {staffRoleLabel(role)} · Выйти
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
        {staffPageAllowed(role, location.pathname) ? (
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="categories" element={<CategoriesAdmin />} />
            <Route path="orders" element={<OrdersAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="support" element={<SupportAdmin />} />
            <Route path="admins" element={<AdminsAdmin />} />
            <Route path="email" element={<EmailSettingsAdmin />} />
            <Route path="payments" element={<PaymentsAdmin />} />
            <Route path="delivery" element={<DeliveryAdmin />} />
            <Route path="reviews" element={<ReviewsAdmin />} />
            <Route path="privacy" element={<PrivacyAdmin />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        ) : (
          <Navigate to={staffHome(role)} replace />
        )}
      </main>
      <nav className="admin-mobile-shortcuts" aria-label="Быстрые разделы">
        {[
          { path: "orders", label: "Заказы", icon: "orders" },
          { path: "products", label: "Товары", icon: "products" },
          { path: "support", label: "Поддержка", icon: "support" },
          { path: "delivery", label: "Доставка", icon: "delivery" },
        ]
          .filter((i) => staffPageAllowed(role, `/admin/${i.path}`))
          .map((i) => (
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
