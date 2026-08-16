import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProducts } from '../context/ProductsContext';
import { useTelegram } from '../lib/telegram';
import { formatPrice, formatNumber } from '../utils/format';
import { ProductCard } from '../components/ProductCard';
import { EmptyState } from '../components/EmptyState';
import { HeartIcon, StarIcon, MinusIcon, PlusIcon, CheckIcon } from '../components/Icons';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const product = products.find((p) => p.id === id);
  const { addToCart, toggleWishlist, isWishlisted, isInCart } = useApp();
  const { haptic, webApp } = useTelegram();
  const [quantity, setQuantity] = useState(1);

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 4);
  }, [product, products]);

  useEffect(() => {
    if (product) {
      const label = isInCart(product.id)
        ? `Перейти в корзину · ${formatPrice(product.price * quantity)}`
        : `В корзину · ${formatPrice(product.price * quantity)}`;
      webApp?.MainButton.setText(label);
      webApp?.MainButton.show();
      webApp?.MainButton.enable();

      const onClick = () => {
        if (isInCart(product.id)) {
          navigate('/cart');
        } else {
          addToCart(product, quantity);
          webApp?.MainButton.setText('Перейти в корзину');
        }
      };
      webApp?.MainButton.onClick(onClick);

      return () => {
        webApp?.MainButton.offClick(onClick);
        webApp?.MainButton.hide();
      };
    }
  }, [product, quantity, webApp, navigate, addToCart, isInCart]);

  if (!product) {
    if (loading) {
      return (
        <div className="app-container">
          <main className="scroll-area">
            <div className="skeleton aspect-square rounded-none" />
            <div className="section-card -mt-5 relative z-10 rounded-t-3xl p-4 space-y-3">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-8 w-1/3" />
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className="app-container">
        <main className="scroll-area">
          <EmptyState
            icon="📦"
            title="Товар не найден"
            description="Возможно, он был удалён"
            actionLabel="В каталог"
            onAction={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  const wishlisted = isWishlisted(product.id);

  return (
    <div className="app-container">
      <main className="scroll-area">
        <div className="aspect-square w-full bg-tg-secondary-bg overflow-hidden">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>

        <div className="section-card -mt-5 relative z-10 rounded-t-3xl p-4 space-y-4">
          {product.badge && (
            <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-md bg-tg-button text-tg-buttonText">
              {product.badge}
            </span>
          )}

          <h1 className="text-lg font-bold text-tg-text leading-snug">{product.name}</h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <StarIcon className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-tg-text">{product.rating}</span>
            </div>
            <span className="text-sm text-tg-hint">·</span>
            <span className="text-sm text-tg-hint">
              {formatNumber(product.reviewsCount)} отзывов
            </span>
          </div>

          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-tg-text">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-base text-tg-hint line-through mb-0.5">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>

          <div className="pt-2 border-t border-tg-separator">
            <h2 className="text-sm font-semibold text-tg-text mb-1.5">Описание</h2>
            <p className="text-sm text-tg-hint leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-tg-separator">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                product.inStock ? 'text-green-500' : 'text-red-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${product.inStock ? 'bg-green-500' : 'bg-red-500'}`}
              />
              {product.inStock ? 'В наличии' : 'Нет в наличии'}
            </span>
          </div>

          {product.inStock && (
            <div className="pt-2 border-t border-tg-separator">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-tg-text">Количество</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      haptic.impact('light');
                      setQuantity((q) => Math.max(1, q - 1));
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-tg-secondary-bg text-tg-text active:scale-90 transition-transform"
                  >
                    <MinusIcon className="w-5 h-5" />
                  </button>
                  <span className="w-6 text-center font-semibold">{quantity}</span>
                  <button
                    onClick={() => {
                      haptic.impact('light');
                      setQuantity((q) => q + 1);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-tg-secondary-bg text-tg-text active:scale-90 transition-transform"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => toggleWishlist(product.id)}
            className={`btn w-full ${wishlisted ? 'bg-red-50 text-red-500' : 'btn-secondary'}`}
            style={wishlisted ? { backgroundColor: 'rgba(239,68,68,0.1)' } : undefined}
          >
            <HeartIcon className="w-5 h-5" filled={wishlisted} />
            {wishlisted ? 'В избранном' : 'В избранное'}
          </button>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-tg-secondary-bg">
              <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-xs text-tg-hint">Бесплатная доставка от 5000 ₽</span>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-tg-secondary-bg">
              <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-xs text-tg-hint">Гарантия возврата 14 дней</span>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-4">
            <h2 className="text-base font-bold text-tg-text mb-3 px-1">Похожие товары</h2>
            <div className="product-grid">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
        <div className="h-4" />
      </main>
    </div>
  );
}
