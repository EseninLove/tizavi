import { BrandLogo } from "../components/BrandLogo";
import { StorefrontHome, StorefrontFooter } from "../components/StorefrontHome";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useApp } from "../context/AppContext";
import { ProductCard } from "../components/ProductCard";
import { EmptyState } from "../components/EmptyState";
import { SubscriptionBanner } from "../components/SubscriptionBanner";
import { DeliveryAddress } from "../components/DeliveryAddress";
import { SearchIcon } from "../components/Icons";
import { matchesProduct } from "../utils/search";
import { formatPrice, pluralize } from "../utils/format";
const initial = () => {
  try {
    return JSON.parse(sessionStorage.getItem("tizavi_catalog") || "{}");
  } catch {
    return {};
  }
};
export function Catalog() {
  const { user: account, miniApp, loading: authLoading } = useAuth();
  const { products, categories, loading, error, reload } = useProducts(),
    { active, loading: subLoading } = useSubscription(),
    { cartCount, cartTotal } = useApp(),
    navigate = useNavigate();
  const [category, setCategory] = useState<string>(
      () => initial().category || "all",
    ),
    [section, setSection] = useState<string>(() => initial().section || "all");
  const [search, setSearch] = useState<string>(() => initial().search || ""),
    [showSearch, setShowSearch] = useState(() => !!initial().search),
    [drawer, setDrawer] = useState(false),
    [filters, setFilters] = useState(false);
  const [brand, setBrand] = useState<string>(() => initial().brand || ""),
    [minPrice, setMinPrice] = useState<string>(() => initial().minPrice || ""),
    [maxPrice, setMaxPrice] = useState<string>(() => initial().maxPrice || ""),
    [stock, setStock] = useState<boolean>(() => !!initial().stock),
    [sort, setSort] = useState<string>(() => initial().sort || "default");
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tizavi_search_history") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    sessionStorage.setItem(
      "tizavi_catalog",
      JSON.stringify({
        category,
        section,
        search,
        brand,
        minPrice,
        maxPrice,
        stock,
        sort,
      }),
    );
  }, [category, section, search, brand, minPrice, maxPrice, stock, sort]);
  useEffect(() => {
    if (!drawer) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", close);
    };
  }, [drawer]);
  const brands = useMemo(
    () =>
      [
        ...new Set(
          products.map((p) => p.brand).filter((b): b is string => !!b),
        ),
      ].sort(),
    [products],
  );
  const list = useMemo(() => {
    let result = products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        matchesProduct(p, search) &&
        (!brand || p.brand === brand) &&
        (!stock || p.inStock) &&
        (minPrice === "" || p.price >= Number(minPrice)) &&
        (maxPrice === "" || p.price <= Number(maxPrice)),
    );
    if (section === "sale")
      result = result.filter((p) => p.oldPrice && p.oldPrice > p.price);
    if (section === "popular")
      result = result
        .filter((p) => p.popular || (p.purchaseCount || 0) > 0)
        .sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
    if (section === "seasonal") result = result.filter((p) => p.seasonal);
    if (sort === "price-up") result.sort((a, b) => a.price - b.price);
    if (sort === "price-down") result.sort((a, b) => b.price - a.price);
    if (sort === "popular")
      result.sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
    return result;
  }, [
    products,
    category,
    section,
    search,
    brand,
    stock,
    minPrice,
    maxPrice,
    sort,
  ]);
  const remember = () => {
    const q = search.trim();
    if (q.length < 2) return;
    const next = [
      q,
      ...history.filter((s) => s.toLowerCase() !== q.toLowerCase()),
    ].slice(0, 8);
    setHistory(next);
    localStorage.setItem("tizavi_search_history", JSON.stringify(next));
  };
  const reset = () => {
    setCategory("all");
    setSection("all");
    setSearch("");
    setBrand("");
    setStock(false);
    setMinPrice("");
    setMaxPrice("");
    setSort("default");
  };
  const [browseRequest, setBrowseRequest] = useState(0);
  useEffect(() => {
    if (browseRequest)
      document.getElementById("catalog-products")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
  }, [browseRequest]);
  const browse = (nextCategory = "all", nextSection = "all") => {
    reset();
    setCategory(nextCategory);
    setSection(nextSection);
    setBrowseRequest((v) => v + 1);
  };
  const showHome =
    category === "all" &&
    section === "all" &&
    !search &&
    !brand &&
    !minPrice &&
    !maxPrice &&
    !stock &&
    !showSearch &&
    !filters;
  const selected =
    categories.find((c) => c.id === category)?.name || "Все категории";
  return (
    <div className="app-container catalog-page market-page">
      <div className="market-topline">
        {!miniApp && (
          <div className="catalog-mobile-account flex items-center justify-between">
            <BrandLogo />
            <button
              disabled={authLoading}
              className="text-xs px-3 py-2 rounded-xl bg-tg-section-bg"
              onClick={() => navigate(account ? "/profile" : "/auth")}
            >
              {authLoading
                ? "Загрузка…"
                : account
                  ? "Мой профиль"
                  : "Вход / Регистрация"}
            </button>
          </div>
        )}
        <div className="catalog-delivery">
          <DeliveryAddress />
        </div>
      </div>
      {showHome && (
        <StorefrontHome
          categories={categories}
          products={products}
          onBrowse={browse}
        />
      )}
      <header
        id="catalog-products"
        className="sticky top-0 z-40 bg-tg-secondary-bg/95 backdrop-blur-lg px-4 pt-3 pb-3 space-y-2"
      >
        <div className="catalog-title-row">
          <div className="catalog-heading">
            <h2 aria-level={showHome ? 2 : 1}>
              {category !== "all"
                ? selected
                : section === "sale"
                  ? "Акции"
                  : section === "popular"
                    ? "Популярное"
                    : section === "seasonal"
                      ? "Сезонное"
                      : "Наши продукты"}
            </h2>
            <p>
              {category !== "all"
                ? "Выбрано для вас"
                : "Выбирайте то, что любите"}
            </p>
          </div>
          <div className="catalog-actions">
            <button
              className="catalog-control"
              aria-label="Все категории"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
              <span>Категории</span>
            </button>
            <button
              className={`catalog-control ${showSearch ? "active" : ""}`}
              aria-label={showSearch ? "Закрыть поиск" : "Поиск"}
              aria-expanded={showSearch}
              onClick={() => {
                setShowSearch((v) => !v);
                setBrowseRequest((v) => v + 1);
                if (showSearch) setSearch("");
              }}
            >
              <SearchIcon className="w-5 h-5" />
              <span>{showSearch ? "Закрыть" : "Поиск"}</span>
            </button>
            <button
              className={`catalog-control ${filters ? "active" : ""}`}
              aria-label="Фильтры"
              aria-expanded={filters}
              onClick={() => {
                setFilters((v) => !v);
                setBrowseRequest((v) => v + 1);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path
                  d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6"
                  strokeLinecap="round"
                />
              </svg>
              <span>Фильтры</span>
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="catalog-search-area">
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    remember();
                    e.currentTarget.blur();
                  }
                }}
                onBlur={remember}
                aria-label="Поиск товаров"
                placeholder="Товар или бренд"
                className="input"
                autoFocus
              />
              {search && (
                <button
                  aria-label="Очистить поиск"
                  onClick={() => setSearch("")}
                  className="px-3"
                >
                  ✕
                </button>
              )}
            </div>
            {!search && history.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {history.map((q) => (
                  <button
                    key={q}
                    onClick={() => setSearch(q)}
                    className="chip chip-inactive text-xs"
                  >
                    {q}
                  </button>
                ))}
                <button
                  className="text-xs text-tg-hint"
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem("tizavi_search_history");
                  }}
                >
                  Очистить историю
                </button>
              </div>
            )}
          </div>
        )}
        <div className="catalog-section-tabs flex gap-2 overflow-auto no-scrollbar">
          {[
            ["all", "Все"],
            ["sale", "Акции"],
            ["popular", "Популярное"],
            ["seasonal", "Сезонное"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setBrowseRequest((v) => v + 1);
              }}
              className={`chip ${section === id ? "chip-active" : "chip-inactive"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {filters && (
          <div className="catalog-filters section-card p-3 space-y-3">
            <label className="block text-xs">
              Бренд
              <select
                aria-label="Бренд"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="input mt-1"
              >
                <option value="">Все бренды</option>
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <input
                aria-label="Цена от"
                type="number"
                min="0"
                placeholder="Цена от"
                className="input"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                aria-label="Цена до"
                type="number"
                min="0"
                placeholder="Цена до"
                className="input"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-tg-hint">
              Сравнивается цена указанной единицы продажи.
            </p>
            <select
              aria-label="Сортировка"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input"
            >
              <option value="default">По умолчанию</option>
              <option value="price-up">Сначала дешевле</option>
              <option value="price-down">Сначала дороже</option>
              <option value="popular">По популярности</option>
            </select>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={stock}
                onChange={(e) => setStock(e.target.checked)}
              />
              Только в наличии
            </label>
            <button onClick={reset} className="text-sm text-tg-link">
              Сбросить всё
            </button>
          </div>
        )}
      </header>
      {!subLoading && !active && <SubscriptionBanner />}
      <main
        className={`scroll-area px-4 pt-3 ${cartCount ? "catalog-with-cart" : ""}`}
      >
        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="section-card skeleton aspect-[3/4]" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon="⚠️"
            title="Ошибка загрузки"
            description={error}
            actionLabel="Повторить"
            onAction={reload}
          />
        ) : list.length ? (
          <>
            <p className="text-xs text-tg-hint mb-3">
              {list.length}{" "}
              {pluralize(list.length, ["товар", "товара", "товаров"])}
            </p>
            <div className="product-grid">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="🔍"
            title="Ничего не найдено"
            description="Измените запрос или сбросьте фильтры"
            actionLabel="Показать все товары"
            onAction={reset}
          />
        )}
      </main>
      {showHome && <StorefrontFooter />}
      {cartCount > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40 floating-cart">
          <button
            onClick={() => navigate("/cart")}
            className="btn-primary w-full shadow-lg justify-between"
          >
            <span>
              Корзина · {cartCount}{" "}
              {pluralize(cartCount, ["позиция", "позиции", "позиций"])}
            </span>
            <span>{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}
      {drawer && (
        <div
          className="fixed inset-0 bg-black/50 z-[80]"
          onClick={() => setDrawer(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Категории"
            className="h-full w-[85%] max-w-sm bg-tg-section-bg p-4 overflow-y-auto animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-lg">Категории</h2>
              <button
                aria-label="Закрыть категории"
                onClick={() => setDrawer(false)}
                className="w-10 h-10"
              >
                ✕
              </button>
            </div>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  browse(c.id);
                  setDrawer(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl p-3 mb-2 text-left ${category === c.id ? "bg-tg-button text-tg-button-text" : "bg-tg-secondary-bg"}`}
              >
                {c.image ? (
                  <img
                    src={c.image}
                    alt=""
                    className="w-11 h-11 object-cover rounded-lg"
                  />
                ) : (
                  <span className="w-11 h-11 flex items-center justify-center text-2xl">
                    {c.id === "all" ? "🛒" : c.emoji || "📦"}
                  </span>
                )}
                <span className="text-sm font-semibold">
                  {c.id === "all" ? "Все категории" : c.name}
                </span>
              </button>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
