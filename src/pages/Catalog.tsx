import { useMemo, useState } from 'react';
import { useProducts } from '../context/ProductsContext';
import { ProductCard } from '../components/ProductCard';
import { EmptyState } from '../components/EmptyState';
import { useTelegram } from '../lib/telegram';
import { SearchIcon } from '../components/Icons';

export function Catalog() {
  const { products, categories, loading, error, reload } = useProducts();
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { haptic } = useTelegram();

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== 'all' && !search.trim()) {
      list = list.filter((p) => p.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, activeCategory, search]);

  return (
    <div className="app-container">
      <header className="sticky top-0 z-40 bg-tg-secondary-bg/95 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-xl font-bold text-tg-text">Каталог</h1>
          <button
            onClick={() => {
              haptic.select();
              setShowSearch((s) => !s);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-tg-section-bg text-tg-text active:scale-90 transition-transform"
            aria-label="Поиск"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
        </div>

        {showSearch && (
          <div className="px-4 pb-2">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tg-hint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск товаров..."
                autoFocus
                className="input pl-10"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                haptic.select();
                setActiveCategory(cat.id);
                setSearch('');
              }}
              className={`chip ${activeCategory === cat.id && !search ? 'chip-active' : 'chip-inactive'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <main className="scroll-area px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="section-card overflow-hidden">
                <div className="skeleton aspect-square rounded-none" />
                <div className="p-2.5 space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              </div>
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
        ) : filtered.length > 0 ? (
          <>
            <p className="text-xs text-tg-hint mb-3">Найдено: {filtered.length}</p>
            <div className="product-grid">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="🔍"
            title="Ничего не найдено"
            description="Попробуйте изменить запрос или выбрать другую категорию"
          />
        )}
      </main>
    </div>
  );
}
