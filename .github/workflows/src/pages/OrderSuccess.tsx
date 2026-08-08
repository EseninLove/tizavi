import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatPrice, formatDate } from '../utils/format';
import { CheckIcon } from '../components/Icons';

export function OrderSuccess() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders } = useApp();
  const order = orders.find((o) => o.id === id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!order) {
    return (
      <div className="app-container">
        <main className="scroll-area flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-tg-hint">Заказ не найден</p>
            <button onClick={() => navigate('/')} className="btn-primary mt-4">
              В каталог
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <main className="scroll-area px-4">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4">
            <CheckIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-xl font-bold text-tg-text">Заказ оформлен!</h1>
          <p className="text-sm text-tg-hint mt-1 max-w-xs">
            Спасибо за заказ. Мы свяжемся с вами в ближайшее время для подтверждения.
          </p>
        </div>

        <div className="section-card p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-tg-hint">Номер заказа</span>
            <span className="text-sm font-semibold text-tg-text">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-tg-hint">Дата</span>
            <span className="text-sm text-tg-text">{formatDate(order.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-tg-hint">Оплата</span>
            <span className="text-sm text-tg-text">
              {order.paymentMethod === 'stars' ? '⭐ Telegram Stars' : '💳 Карта'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-tg-hint">Статус</span>
            <span className="text-sm font-semibold text-green-500">Оплачен</span>
          </div>
        </div>

        <div className="section-card mt-4 p-4">
          <h2 className="text-sm font-semibold text-tg-text mb-3">Состав заказа</h2>
          <div className="space-y-3">
            {order.items.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-3">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-tg-text line-clamp-1">{product.name}</h3>
                  <span className="text-xs text-tg-hint">{quantity} шт.</span>
                </div>
                <span className="text-sm font-medium text-tg-text">
                  {formatPrice(product.price * quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-tg-separator mt-3 pt-3 flex justify-between">
            <span className="font-semibold text-tg-text">Итого</span>
            <span className="font-bold text-tg-text">{formatPrice(order.total + (order.total >= 5000 ? 0 : 290))}</span>
          </div>
        </div>

        {order.delivery.deliveryType === 'courier' && (
          <div className="section-card mt-4 p-4 space-y-1">
            <h2 className="text-sm font-semibold text-tg-text mb-2">Доставка</h2>
            <p className="text-sm text-tg-text">{order.delivery.name}</p>
            <p className="text-sm text-tg-hint">{order.delivery.phone}</p>
            <p className="text-sm text-tg-hint">
              {order.delivery.city}, {order.delivery.address}
            </p>
            {order.delivery.comment && (
              <p className="text-sm text-tg-hint italic">«{order.delivery.comment}»</p>
            )}
          </div>
        )}

        <div className="mt-6 space-y-2">
          <button onClick={() => navigate('/', { replace: true })} className="btn-primary w-full">
            Продолжить покупки
          </button>
          <button onClick={() => navigate('/profile', { replace: true })} className="btn-secondary w-full">
            Мои заказы
          </button>
        </div>
      </main>
    </div>
  );
}
