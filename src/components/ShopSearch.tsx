import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { matchesCategory, matchesProduct } from "../utils/search";
import { formatPrice } from "../utils/format";
import { SearchIcon } from "./Icons";

export function ShopSearch({ mobile = false }: { mobile?: boolean }) {
  const location = useLocation(),
    navigate = useNavigate();
  const { products, categories, loading, error } = useProducts();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    toggle = useRef<HTMLButtonElement>(null);
  const id = useId(),
    term = query.trim();
  const foundCategories = useMemo(
    () =>
      term.length >= 2
        ? categories.filter((c) => matchesCategory(c, term))
        : [],
    [categories, term],
  );
  const foundProducts = useMemo(
    () =>
      term.length >= 2 ? products.filter((p) => matchesProduct(p, term)) : [],
    [products, term],
  );
  useEffect(() => {
    setOpen(false);
    setQuery(
      location.pathname === "/search"
        ? new URLSearchParams(location.search).get("q") || ""
        : "",
    );
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (mobile) toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, mobile]);
  useEffect(() => {
    if (open && mobile) input.current?.focus();
  }, [open, mobile]);
  const searchForm = (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (term.length >= 2) {
          setOpen(false);
          navigate(`/search?q=${encodeURIComponent(term)}`);
        }
      }}
      className="shop-search-form"
    >
      <SearchIcon className="w-4 h-4" />
      <input
        ref={input}
        type="search"
        maxLength={160}
        aria-label="Поиск товаров и категорий"
        placeholder="Товары и категории"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            if (mobile) toggle.current?.focus();
          }
        }}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        autoComplete="off"
      />
      {mobile && (
        <button
          type="button"
          aria-label="Закрыть поиск"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        >
          ×
        </button>
      )}
    </form>
  );
  return (
    <div
      ref={root}
      className={`shop-search ${mobile ? "shop-search-mobile" : "shop-search-desktop"}`}
    >
      {mobile ? (
        <button
          ref={toggle}
          className="shop-search-toggle"
          aria-label={open ? "Закрыть поиск" : "Открыть поиск"}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <SearchIcon className="w-5 h-5" />
        </button>
      ) : (
        searchForm
      )}
      {open && (
        <div id={id} className="shop-search-dropdown">
          {mobile && searchForm}
          <div className="shop-search-results" aria-live="polite">
            {term.length < 2 ? (
              <p className="shop-search-hint">
                Введите хотя бы 2 символа. Ищем по товарам и категориям.
              </p>
            ) : loading ? (
              <p className="shop-search-hint">Загружаем каталог…</p>
            ) : error ? (
              <p className="shop-search-hint">
                Не удалось загрузить каталог.{" "}
                <Link
                  to={`/search?q=${encodeURIComponent(term)}`}
                  onClick={() => setOpen(false)}
                >
                  Повторить поиск →
                </Link>
              </p>
            ) : (
              <>
                {foundCategories.length > 0 && (
                  <>
                    <h2>
                      Категории <span>{foundCategories.length}</span>
                    </h2>
                    {foundCategories.slice(0, 5).map((c) => (
                      <Link
                        key={c.id}
                        className="shop-search-category"
                        to={`/?category=${encodeURIComponent(c.id)}#catalog-products`}
                        onClick={() => setOpen(false)}
                      >
                        <span aria-hidden="true">{c.emoji || "▦"}</span>
                        {c.name}
                        <span aria-hidden="true">↗</span>
                      </Link>
                    ))}
                  </>
                )}
                {foundProducts.length > 0 && (
                  <>
                    <h2>
                      Товары <span>{foundProducts.length}</span>
                    </h2>
                    {foundProducts.slice(0, 6).map((p) => (
                      <Link
                        key={p.id}
                        className="shop-search-product"
                        to={`/product/${p.id}`}
                        onClick={() => setOpen(false)}
                      >
                        <img src={p.image} alt="" />
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.inStock
                              ? `${formatPrice(p.price)}${p.unit && p.unit !== "шт" ? `/${p.unit}` : ""}`
                              : "Нет в наличии"}
                          </small>
                        </span>
                        <span aria-hidden="true">↗</span>
                      </Link>
                    ))}
                  </>
                )}
                {!foundCategories.length && !foundProducts.length ? (
                  <p className="shop-search-hint">
                    Ничего не найдено. Попробуйте другое название.
                  </p>
                ) : (
                  <Link
                    className="shop-search-all"
                    onClick={() => setOpen(false)}
                    to={`/search?q=${encodeURIComponent(term)}`}
                  >
                    Все результаты <span aria-hidden="true">→</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
