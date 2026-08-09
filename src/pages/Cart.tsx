import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTelegram } from '../lib/telegram';
import { formatPrice, pluralize } from '../utils/format';
import { EmptyState } from '../components/EmptyState';
import { TrashIcon, MinusIcon, PlusIcon } from '../components/Icons';
import { useEffect } from 'react';

export function Cart() {
  const navigate = useNavigate();
  const { cart, cartCount, cartTotal, updateQuantity, removeFromCart, clearCart } = useApp();
  const { haptic } = useTelegram();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (cart.length === 0) {
    return (
      <div className="app-container">
        <header className="px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-tg-text">Корзина</h1>
        </header>
        <main className="scroll-area">
          <EmptyState
            icon="🛒"
            title="Корзина пуста"
            description="Добавьте товары из каталога, чтобы оформить заказ"
            actionLabel="Перейти в каталог"
            onAction={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="text-xl font-bold text-tg-text">Корзина</h1>
          <p className="text-xs text-tg-hint">
            {cartCount} {pluralize(cartCount, ['товар', 'товара', 'товаров'])}
          </p>
        </div>
        <button
          onClick={() => {
            haptic.impact('medium');
            clearCart();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-tg-section-bg text-red-500 text-sm font-medium active:scale-95 transition-transform"
        >
          <TrashIcon className="w-4 h-4" />
          Очистить
        </button>
      </header>

      <main className="scroll-area px-4">
        <div className="space-y-3">
          {cart.map(({ product, quantity }) => (
            <div key={product.id} className="section-card flex gap-3 p-3">
              <img
                src={product.image}
                alt={product.name}
                className="w-20 h-20 rounded-xl object-cover shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-sm font-medium text-tg-text line-clamp-2 leading-snug cursor-pointer"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    {product.name}
                  </h3>
                  <button
                    onClick={() => removeFromCart(product.id)}
                    className="shrink-0 text-tg-hint active:scale-90 transition-transform"
                    aria-label="Удалить"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-end justify-between mt-auto">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-tg-secondary-bg text-tg-text active:scale-90 transition-transform"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-tg-secondary-bg text-tg-text active:scale-90 transition-transform"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-tg-text">
                    {formatPrice(product.price * quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-card mt-4 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-tg-hint">Товары ({cartCount})</span>
            <span className="text-tg-text font-medium">{formatPrice(cartTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-tg-hint">Доставка</span>
            <span className="text-tg-text font-medium">
              {cartTotal >= 5000 ? 'Бесплатно' : 'от 290 ₽'}
            </span>
          </div>
          <div className="border-t border-tg-separator pt-2 flex justify-between">
            <span className="text-tg-text font-semibold">Итого</span>
            <span className="text-tg-text font-bold text-lg">
              {formatPrice(cartTotal + (cartTotal >= 5000 ? 0 : 290))}
            </span>
          </div>
        </div>
        <div className="h-4" />
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pb-[5.5rem] pt-3 bg-gradient-to-t from-tg-secondary-bg via-tg-secondary-bg to-transparent">
        <button onClick={() => navigate('/checkout')} className="btn-primary w-full">
          Оформить заказ · {formatPrice(cartTotal + (cartTotal >= 5000 ? 0 : 290))}
        </button>
      </div>
    </div>
  );
}
