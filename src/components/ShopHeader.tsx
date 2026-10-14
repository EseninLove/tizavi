import { CategoriesLink } from "./CategoriesLink";
import { BrandLogo } from "./BrandLogo";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { HomeIcon, CartIcon, HeartIcon, UserIcon } from "./Icons";
export function ShopHeader() {
  const { cartCount, wishlist } = useApp(),
    { user, loading } = useAuth();
  const links = [
    { to: "/", label: "Каталог", Icon: HomeIcon, count: 0 },
    {
      to: "/wishlist",
      label: "Избранное",
      Icon: HeartIcon,
      count: wishlist.length,
    },
    { to: "/cart", label: "Корзина", Icon: CartIcon, count: cartCount },
    { to: "/profile", label: "Профиль", Icon: UserIcon, count: 0 },
  ];
  return (
    <header className="shop-desktop-header">
      <div className="shop-desktop-header-inner">
        <Link to="/" className="shop-brand" aria-label="тизави.рф — в каталог">
          <BrandLogo />
          <span className="shop-brand-tagline">Продукты с доставкой</span>
        </Link>
        <CategoriesLink />
        <nav aria-label="Навигация магазина">
          {links.map(({ to, label, Icon, count }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={
                to === "/cart" ? `Корзина, позиций: ${cartCount}` : label
              }
              className={({ isActive }) =>
                `shop-nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="shop-nav-label">{label}</span>
              {(count > 0 || to === "/cart") && (
                <span className="shop-nav-badge">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {!user && !loading && (
          <Link to="/auth" className="shop-login-link">
            Войти
          </Link>
        )}
      </div>
    </header>
  );
}
