import { scrollToCategories } from "../components/CategoriesLink";
import { StorefrontHome, StorefrontFooter } from "../components/StorefrontHome";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useApp } from "../context/AppContext";
import { ProductCard } from "../components/ProductCard";
import { EmptyState } from "../components/EmptyState";
import { SubscriptionBanner } from "../components/SubscriptionBanner";
import { DeliveryAddress } from "../components/DeliveryAddress";
import { formatPrice, pluralize } from "../utils/format";
const initial = () => {
  try {
    return JSON.parse(sessionStorage.getItem("tizavi_catalog") || "{}");
  } catch {
    return {};
  }
};
export function Catalog() {
  const { products, categories, loading, error, reload } = useProducts(),
    { active, loading: subLoading } = useSubscription(),
    { cartCount, cartTotal } = useApp(),
    navigate = useNavigate();
  const [category, setCategory] = useState<string>(
      () => initial().category || "all",
    ),
    [section, setSection] = useState<string>(() => initial().section || "all");
  const [filters, setFilters] = useState(false);
  const [brand, setBrand] = useState<string>(() => initial().brand || ""),
    [minPrice, setMinPrice] = useState<string>(() => initial().minPrice || ""),
    [maxPrice, setMaxPrice] = useState<string>(() => initial().maxPrice || ""),
    [stock, setStock] = useState<boolean>(() => !!initial().stock),
    [sort, setSort] = useState<string>(() => initial().sort || "default");
  useEffect(() => {
    sessionStorage.setItem(
      "tizavi_catalog",
      JSON.stringify({
        category,
        section,
        brand,
        minPrice,
        maxPrice,
        stock,
        sort,
      }),
    );
  }, [category, section, brand, minPrice, maxPrice, stock, sort]);
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
  }, [products, category, section, brand, stock, minPrice, maxPrice, sort]);
  const reset = () => {
    setCategory("all");
    setSection("all");
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
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#categories" && !loading) scrollToCategories();
  }, [location.hash, loading]);
  useEffect(() => {
    const categoryId = new URLSearchParams(location.search).get("category");
    if (categoryId) browse(categoryId);
  }, [location.search, loading]);
  const selected =
    categories.find((c) => c.id === category)?.name || "Все категории";
  return (
    <div className="app-container catalog-page market-page">
      <div className="market-topline">
        <div className="catalog-delivery">
          <DeliveryAddress />
        </div>
      </div>
      {!subLoading && !active && <SubscriptionBanner />}
      <StorefrontHome
        categories={categories}
        products={products}
        onBrowse={browse}
      />
      <header
        id="catalog-products"
        className="sticky top-0 z-40 bg-tg-secondary-bg/95 backdrop-blur-lg px-4 pt-3 pb-3 space-y-2"
      >
        <div className="market-product-toolbar">
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
                aria-pressed={section === id}
                className={`chip ${section === id ? "chip-active" : "chip-inactive"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className={`catalog-control ${filters ? "active" : ""}`}
            aria-label="Фильтры"
            aria-expanded={filters}
            onClick={() => setFilters((v) => !v)}
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
        {category !== "all" && (
          <div className="market-selected-category">
            <span>{selected}</span>
            <button onClick={() => browse()}>Все категории ×</button>
          </div>
        )}
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
            description="Выберите другую подборку или сбросьте фильтры"
            actionLabel="Показать все товары"
            onAction={reset}
          />
        )}
      </main>
      <StorefrontFooter />
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
    </div>
  );
}
