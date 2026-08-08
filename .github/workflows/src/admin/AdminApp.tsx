import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { authApi } from './api';
import { AdminLogin } from './AdminLogin';
import { Dashboard } from './Dashboard';
import { ProductsAdmin } from './ProductsAdmin';
import { OrdersAdmin } from './OrdersAdmin';
import { UsersAdmin } from './UsersAdmin';
import { Settings } from './Settings';

const navItems = [
  { path: '/admin', label: 'Дашборд', icon: '📊', end: true },
  { path: '/admin/products', label: 'Товары', icon: '📦', end: false },
  { path: '/admin/orders', label: 'Заказы', icon: '🛒', end: false },
  { path: '/admin/users', label: 'Пользователи', icon: '👥', end: false },
  { path: '/admin/settings', label: 'Настройки', icon: '⚙️', end: false },
];

export function AdminApp() {
  const [authed, setAuthed] = useState(authApi.isAuthed());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-gray-900 text-white shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-bold">🛒 Tizavi</div>
          <div className="text-xs text-white/50">Admin Panel</div>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => {
              authApi.logout();
              setAuthed(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            ← Выйти
          </button>
        </div>
      </aside>

      {/* Mobile nav header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold">🛒 Tizavi Admin</span>
          <button onClick={() => setMobileNavOpen((v) => !v)} className="text-2xl">
            {mobileNavOpen ? '×' : '☰'}
          </button>
        </div>
        {mobileNavOpen && (
          <nav className="py-2 border-t border-white/10">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/60'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={() => {
                authApi.logout();
                setAuthed(false);
              }}
              className="w-full text-left px-5 py-3 text-sm text-white/50"
            >
              ← Выйти
            </button>
          </nav>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 md:p-8 pt-16 md:pt-8 overflow-x-hidden">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
