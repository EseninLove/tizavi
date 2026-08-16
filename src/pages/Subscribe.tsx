import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { useTelegram } from '../lib/telegram';
import { formatDate } from '../utils/format';

export function Subscribe() {
  const navigate = useNavigate();
  const { active, expiresAt, price, days, loading, refresh } = useSubscription();
  const { haptic, webApp } = useTelegram();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [justActivated, setJustActivated] = useState(false);

  const handleBuy = async () => {
    if (buying) return;
    const initData = webApp?.initData;
    if (!initData || !webApp) {
      setError('Оплата доступна только внутри Telegram');
      return;
    }

    setBuying(true);
    setError('');
    haptic.impact('medium');

    try {
      const invoiceRes = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, action: 'invoice' }),
      });
      const invoiceData = await invoiceRes.json();

      if (!invoiceData.ok || !invoiceData.invoiceLink) {
        setError(invoiceData.error || 'Не удалось создать счёт');
        setBuying(false);
        return;
      }

      webApp.openInvoice(invoiceData.invoiceLink, async (status: string) => {
        if (status !== 'paid') {
          haptic.notify('error');
          setBuying(false);
          return;
        }

        try {
          const activateRes = await fetch('/api/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, action: 'activate' }),
          });
          const activateData = await activateRes.json();
          if (activateData.ok) {
            haptic.notify('success');
            setJustActivated(true);
            await refresh();
          } else {
            setError(activateData.error || 'Не удалось активировать подписку. Обратитесь в поддержку');
          }
        } catch {
          setError('Ошибка соединения при активации подписки');
        } finally {
          setBuying(false);
        }
      });
    } catch {
      setError('Ошибка соединения');
      setBuying(false);
    }
  };

  return (
    <div className="app-container">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-tg-text">Подписка</h1>
      </header>

      <main className="scroll-area px-4 space-y-4">
        {(active || justActivated) && (
          <div className="section-card p-4 flex items-center gap-3 border-green-500/30">
            <span className="w-10 h-10 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-xl shrink-0">
              ✓
            </span>
            <div>
              <div className="text-sm font-bold text-tg-text">Подписка оформлена</div>
              {expiresAt && (
                <div className="text-xs text-tg-hint mt-0.5">
                  Действует до {formatDate(new Date(expiresAt).getTime())}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="section-card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold text-tg-text">
                {price} <span className="text-lg">⭐ Stars</span>
              </div>
              <div className="text-xs text-tg-hint mt-0.5">на {days} дней доступа</div>
            </div>
            <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-tg-secondary-bg text-tg-hint">
              разовый платёж
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-tg-separator">
            {[
              'Оформление неограниченного числа заказов',
              'Доступ ко всем товарам и акциям каталога',
              'Приоритетная доставка в течение 1 часа',
              'Персональные скидки для подписчиков',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-[10px] shrink-0">
                  ✓
                </span>
                <span className="text-sm text-tg-text">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>
        )}

        <div className="section-card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-tg-text">Документы</h2>
          {[
            { path: '/legal/offer', label: 'Договор-оферта на оказание услуг подписки' },
            { path: '/legal/privacy', label: 'Политика обработки персональных данных' },
            { path: '/legal/terms', label: 'Пользовательское соглашение' },
          ].map((doc) => (
            <button
              key={doc.path}
              onClick={() => navigate(doc.path)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-tg-secondary-bg text-left active:scale-[0.98] transition-transform"
            >
              <span className="text-sm text-tg-text">{doc.label}</span>
              <span className="text-tg-hint">›</span>
            </button>
          ))}
          <p className="text-xs text-tg-hint leading-relaxed pt-1">
            Нажимая «Оплатить», вы принимаете условия Договора-оферты, Пользовательского соглашения
            и даёте согласие на обработку персональных данных в соответствии с ФЗ-152 «О персональных данных».
          </p>
        </div>

        <div className="h-2" />
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pb-[5.5rem] pt-3 bg-gradient-to-t from-tg-secondary-bg via-tg-secondary-bg to-transparent">
        <button
          onClick={handleBuy}
          disabled={buying || loading || active}
          className="btn-primary w-full disabled:opacity-50"
        >
          {buying
            ? 'Ожидание оплаты...'
            : active
              ? 'Подписка активна'
              : `Оплатить ${price} ⭐`}
        </button>
      </div>
    </div>
  );
}
