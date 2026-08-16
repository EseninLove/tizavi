import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useTelegram } from '../lib/telegram';
import { formatPrice, pluralize } from '../utils/format';
import { EmptyState } from '../components/EmptyState';
import { CheckIcon } from '../components/Icons';

const PAYMENT_METHOD = 'telegram-pay' as const;

export function Checkout() {
  const navigate = useNavigate();
  const { cart, cartTotal, placeOrder } = useApp();
  const { active: subscribed, loading: subLoading } = useSubscription();
  const { haptic, webApp, user } = useTelegram();

  const [name, setName] = useState(user?.first_name ?? '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const deliveryCost = cartTotal >= 5000 ? 0 : 290;
  const finalTotal = cartTotal + deliveryCost;

  const isValid = name.trim() && phone.trim() && city.trim() && address.trim();

  const handleSubmit = async () => {
    if (!isValid || processing) return;
    setProcessing(true);
    haptic.impact('medium');

    const delivery = { name, phone, city, address, comment, deliveryType: 'courier' as const };
    const itemCount = Math.ceil(cart.reduce((s, i) => s + i.quantity, 0));

    try {
      const response = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Заказ Tizavi Shop (${itemCount} ${pluralize(itemCount, ['товар', 'товара', 'товаров'])})`,
          description: cart.map((i) => `${i.product.name} ×${i.quantity}`).join('\n').slice(0, 255),
          payload: JSON.stringify({ ts: Date.now(), method: PAYMENT_METHOD }),
          method: PAYMENT_METHOD,
          rubAmount: finalTotal,
          initData: webApp?.initData,
        }),
      });

      const data = await response.json();

      if (!data.ok || !data.invoiceLink) {
        if (data.code === 'SUBSCRIPTION_REQUIRED') {
          navigate('/subscribe');
          return;
        }
        webApp?.showAlert(data.error || 'Не удалось создать счёт для оплаты');
        setProcessing(false);
        return;
      }

      if (!webApp) {
        alert('Оплата доступна только внутри Telegram');
        setProcessing(false);
        return;
      }

      webApp.openInvoice(data.invoiceLink, async (status: string) => {
        if (status === 'paid') {
          const order = await placeOrder(delivery, PAYMENT_METHOD);
          navigate(`/order-success/${order.id}`, { replace: true });
        } else {
          haptic.notify('error');
          setProcessing(false);
        }
      });
    } catch {
      webApp?.showAlert('Ошибка соединения при создании счёта');
      setProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="app-container">
        <header className="px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-tg-text">Оформление заказа</h1>
        </header>
        <main className="scroll-area">
          <EmptyState
            icon="🛒"
            title="Корзина пуста"
            description="Добавьте товары, чтобы оформить заказ"
            actionLabel="В каталог"
            onAction={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  if (!subLoading && !subscribed) {
    return (
      <div className="app-container">
        <header className="px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-tg-text">Оформление заказа</h1>
        </header>
        <main className="scroll-area">
          <EmptyState
            icon="⭐"
            title="Нужна подписка"
            description="Оформление заказов доступно только с активной подпиской. Просмотр каталога остаётся бесплатным."
            actionLabel="Оформить подписку"
            onAction={() => navigate('/subscribe')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-tg-text">Оформление заказа</h1>
      </header>

      <main className="scroll-area px-4 space-y-4">
        <section className="section-card p-4 flex items-center gap-3">
          <span className="text-2xl">🚚</span>
          <div>
            <div className="text-sm font-medium text-tg-text">Доставка курьером</div>
            <div className="text-xs text-tg-hint mt-0.5">
              {deliveryCost === 0 ? 'Бесплатно (от 5000 ₽)' : '290 ₽'}
            </div>
          </div>
        </section>

        <section className="section-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-tg-text">Контактные данные</h2>
          <div>
            <label className="block text-xs text-tg-hint mb-1">Имя *</label>
            <input
              className="input"
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-tg-hint mb-1">Телефон *</label>
            <input
              className="input"
              type="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-tg-hint mb-1">Город *</label>
            <input
              className="input"
              placeholder="Город"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-tg-hint mb-1">Адрес *</label>
            <input
              className="input"
              placeholder="Улица, дом, квартира"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-tg-hint mb-1">Комментарий к заказу</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Необязательно"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </section>

        <section className="section-card p-4 flex items-center gap-3">
          <span className="text-2xl">💳</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-tg-text">Банковская карта</div>
            <div className="text-xs text-tg-hint mt-0.5">Visa, Mastercard, МИР</div>
          </div>
          <CheckIcon className="w-5 h-5 text-tg-button shrink-0" />
        </section>

        <section className="section-card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-tg-text">Итого</h2>
          <div className="flex justify-between text-sm">
            <span className="text-tg-hint">Товары</span>
            <span className="text-tg-text font-medium">{formatPrice(cartTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-tg-hint">Доставка</span>
            <span className="text-tg-text font-medium">
              {deliveryCost === 0 ? 'Бесплатно' : formatPrice(deliveryCost)}
            </span>
          </div>
          <div className="border-t border-tg-separator pt-2 flex justify-between items-center">
            <span className="text-tg-text font-semibold">К оплате</span>
            <span className="text-tg-text font-bold text-lg">{formatPrice(finalTotal)}</span>
          </div>
        </section>
        <div className="h-2" />
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pb-[5.5rem] pt-3 bg-gradient-to-t from-tg-secondary-bg via-tg-secondary-bg to-transparent">
        <button
          onClick={handleSubmit}
          disabled={!isValid || processing}
          className="btn-primary w-full"
        >
          {processing ? 'Обработка...' : `Оплатить · ${formatPrice(finalTotal)}`}
        </button>
      </div>
    </div>
  );
}
