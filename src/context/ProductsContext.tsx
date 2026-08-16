import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Category, Product } from '../types';

interface ProductsContextValue {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string;
  reload: () => void;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

const DEFAULT_CATEGORIES: Category[] = [{ id: 'all', name: 'Все', emoji: '🛍️' }];

interface DbProductRow {
  id: number;
  name: string;
  description: string;
  price: number;
  old_price: number | null;
  image: string;
  category: string;
  rating: number;
  reviews_count: number;
  in_stock: boolean;
  badge: string | null;
}

function mapProduct(row: DbProductRow): Product {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    oldPrice: row.old_price ? Number(row.old_price) : undefined,
    image: row.image,
    category: row.category,
    rating: Number(row.rating) || 5,
    reviewsCount: Number(row.reviews_count) || 0,
    inStock: row.in_stock !== false,
    badge: row.badge || undefined,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadFlag, setReloadFlag] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
        ]);

        if (!cancelled) {
          const productsData = await productsRes.json();
          if (productsData.ok) {
            setProducts((productsData.products || []).map(mapProduct));
          } else {
            setError('Не удалось загрузить товары');
          }

          try {
            const categoriesData = await categoriesRes.json();
            if (categoriesData.ok && Array.isArray(categoriesData.categories)) {
              const mapped: Category[] = categoriesData.categories.map(
                (c: { slug: string; name: string; emoji: string }) => ({
                  id: c.slug,
                  name: c.name,
                  emoji: c.emoji,
                })
              );
              setCategories([{ id: 'all', name: 'Все', emoji: '🛍️' }, ...mapped]);
            }
          } catch {
            // категории недоступны — оставим дефолтные
          }
        }
      } catch {
        if (!cancelled) setError('Ошибка соединения');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadFlag]);

  const value = useMemo<ProductsContextValue>(
    () => ({
      products,
      categories,
      loading,
      error,
      reload: () => setReloadFlag((f) => f + 1),
    }),
    [products, categories, loading, error]
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
