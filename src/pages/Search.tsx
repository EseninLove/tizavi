import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProducts } from "../context/ProductsContext";
import { matchesCategory, matchesProduct } from "../utils/search";
import { ProductCard } from "../components/ProductCard";
import { EmptyState } from "../components/EmptyState";
import { pluralize } from "../utils/format";

export function Search() {
  const [params] = useSearchParams(),
    query = (params.get("q") || "").trim();
  const { products, categories, loading, error, reload } = useProducts();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [query]);
  const foundCategories =
    query.length >= 2
      ? categories.filter((c) => matchesCategory(c, query))
      : [];
  const foundProducts =
    query.length >= 2 ? products.filter((p) => matchesProduct(p, query)) : [];
  return (
    <div className="app-container search-page">
      <header>
        <span className="market-eyebrow">Каталог магазина</span>
        <h1>Результаты поиска</h1>
        <p>
          {query
            ? `По запросу «${query}»`
            : "Найдите нужное через поиск в шапке"}
        </p>
      </header>
      <main className="scroll-area">
        {query.length < 2 ? (
          <p>Введите хотя бы 2 символа в поиске сверху.</p>
        ) : loading ? (
          <p aria-live="polite">Загружаем каталог…</p>
        ) : error ? (
          <EmptyState
            icon="⚠️"
            title="Не удалось загрузить каталог"
            description={error}
            actionLabel="Повторить"
            onAction={reload}
          />
        ) : (
          <>
            {foundCategories.length > 0 && (
              <section className="search-category-section">
                <h2>
                  Категории <span>{foundCategories.length}</span>
                </h2>
                <div>
                  {foundCategories.map((c) => (
                    <Link
                      key={c.id}
                      to={`/?category=${encodeURIComponent(c.id)}#catalog-products`}
                    >
                      <span aria-hidden="true">{c.emoji || "▦"}</span>
                      {c.name}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {foundProducts.length > 0 && (
              <section>
                <h2>
                  Товары{" "}
                  <span>
                    {foundProducts.length}{" "}
                    {pluralize(foundProducts.length, [
                      "товар",
                      "товара",
                      "товаров",
                    ])}
                  </span>
                </h2>
                <div className="product-grid">
                  {foundProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            )}
            {!foundProducts.length && !foundCategories.length && (
              <EmptyState
                icon="🔍"
                title="Ничего не найдено"
                description="Попробуйте другое название товара, бренда или категории."
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
