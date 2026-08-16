import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useTelegram } from '../lib/telegram';
import { formatPrice, formatDate } from '../utils/format';
import { EmptyState } from '../components/EmptyState';
import { useState } from 'react';

export function Profile() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const { orders, wishlist, cartCount } = useApp();
  const { active: subscribed, expiresAt, price, days, loading: subLoading } = useSubscription();
  const [showAllOrders, setShowAllOrders] = useState(false);

  const displayName = user
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : 'Гость';
  const initials = (user?.first_name?.[0] ?? 'Г').toUpperCase();

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 3);

  return (
    <div className="app-container">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-tg-text">Профиль</h1>
      </header>

      <main className="scroll-area px-4 space-y-4">
        <section className="section-card p-4 flex items-center gap-4">
          {user?.photo_url ? (
            <img
              src={user.photo_url}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-tg-button text-tg-buttonText flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-tg-text truncate">{displayName}</h2>
            {user?.username && (
              <p className="text-sm text-tg-hint">@{user.username}</p>
            )}
            {user?.language_code && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-md bg-tg-secondary-bg text-tg-hint">
                {user.language_code.toUpperCase()}
              </span>
            )}
          </div>
        </section>

        <section
          className={`section-card p-4 flex items-center gap-3 ${
            subscribed ? 'border-green-500/30' : ''
          }`}
        >
          {subLoading ? (
            <>
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-40" />
              </div>
            </>
          ) : subscribed ? (
            <>
              <span className="w-10 h-10 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-xl shrink-0">
                ✓
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-tg-text">Подписка оформлена</div>
                {expiresAt && (
                  <div className="text-xs text-tg-hint mt-0.5">
                    Действует до {formatDate(new Date(expiresAt).getTime())}
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/subscribe')}
                className="px-3 py-2 rounded-xl bg-tg-secondary-bg text-xs font-semibold text-tg-text active:scale-95 transition-transform shrink-0"
              >
                Продлить
              </button>
            </>
          ) : (
            <>
              <span className="w-10 h-10 rounded-full bg-tg-secondary-bg text-tg-hint flex items-center justify-center text-xl shrink-0">
                ⭐
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-tg-text">Подписка не оформлена</div>
                <div className="text-xs text-tg-hint mt-0.5">
                  {price} ⭐ на {days} дней — без неё заказы недоступны
                </div>
              </div>
              <button
                onClick={() => navigate('/subscribe')}
                className="px-3 py-2 rounded-xl bg-tg-button text-tg-buttonText text-xs font-semibold active:scale-95 transition-transform shrink-0"
              >
                Оформить
              </button>
            </>
          )}
        </section>

        <section className="grid grid-cols-3 gap-2">
          <button
            onClick={() => navigate('/cart')}
            className="section-card p-3 flex flex-col items-center active:scale-95 transition-transform"
          >
            <span className="text-2xl font-bold text-tg-button">{cartCount}</span>
            <span className="text-xs text-tg-hint mt-0.5">В корзине</span>
          </button>
          <button
            onClick={() => navigate('/wishlist')}
            className="section-card p-3 flex flex-col items-center active:scale-95 transition-transform"
          >
            <span className="text-2xl font-bold text-tg-button">{wishlist.length}</span>
            <span className="text-xs text-tg-hint mt-0.5">Избранное</span>
          </button>
          <div className="section-card p-3 flex flex-col items-center">
            <span className="text-2xl font-bold text-tg-button">{orders.length}</span>
            <span className="text-xs text-tg-hint mt-0.5">Заказов</span>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-base font-bold text-tg-text">Мои заказы</h2>
            {orders.length > 3 && (
              <button
                onClick={() => setShowAllOrders((s) => !s)}
                className="text-sm text-tg-button font-medium"
              >
                {showAllOrders ? 'Свернуть' : 'Все'}
              </button>
            )}
          </div>

          {visibleOrders.length > 0 ? (
            <div className="space-y-3">
              {visibleOrders.map((order) => (
                <div key={order.id} className="section-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-tg-text">{order.id}</h3>
                      <p className="text-xs text-tg-hint">{formatDate(order.createdAt)}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-green-100 text-green-700">
                      Оплачен
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {order.items.slice(0, 4).map(({ product }) => (
                      <img
                        key={product.id}
                        src={product.image}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ))}
                    {order.items.length > 4 && (
                      <div className="w-10 h-10 rounded-lg bg-tg-secondary-bg flex items-center justify-center text-xs text-tg-hint font-medium">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-tg-separator">
                    <span className="text-xs text-tg-hint">
                      {order.items.reduce((s, i) => s + i.quantity, 0)} товаров
                    </span>
                    <span className="text-sm font-bold text-tg-text">
                      {formatPrice(order.total + (order.total >= 5000 ? 0 : 290))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📦"
              title="Заказов пока нет"
              description="Оформите первый заказ, и он появится здесь"
              actionLabel="В каталог"
              onAction={() => navigate('/')}
            />
          )}
        </section>

        <section className="section-card divide-y divide-tg-separator">
          <button
            onClick={() => navigate('/legal/offer')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-tg-secondary-bg transition-colors"
          >
            <span className="text-sm text-tg-text">📄 Договор-оферта</span>
            <span className="text-tg-hint">›</span>
          </button>
          <button
            onClick={() => navigate('/legal/privacy')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-tg-secondary-bg transition-colors"
          >
            <span className="text-sm text-tg-text">🔒 Политика конфиденциальности</span>
            <span className="text-tg-hint">›</span>
          </button>
          <button
            onClick={() => navigate('/legal/terms')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-tg-secondary-bg transition-colors"
          >
            <span className="text-sm text-tg-text">📋 Пользовательское соглашение</span>
            <span className="text-tg-hint">›</span>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-tg-secondary-bg transition-colors">
            <span className="text-sm text-tg-text">📞 Поддержка</span>
            <span className="text-tg-hint">›</span>
          </button>
        </section>

        <p className="text-center text-xs text-tg-hint pt-2">Tizavi Shop · v1.0.0</p>
        <div className="h-2" />
      </main>
    </div>
  );
}
