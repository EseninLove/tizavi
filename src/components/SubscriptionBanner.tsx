import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { useTelegram } from '../lib/telegram';

export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { price, days } = useSubscription();
  const { haptic } = useTelegram();

  return (
    <div className="mx-4 mt-3 rounded-2xl overflow-hidden">
      <div className="bg-tg-button/10 border border-tg-button/30 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">⭐</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-tg-text">Нужна подписка</h3>
            <p className="text-xs text-tg-hint mt-0.5 leading-relaxed">
              Каталог доступен для просмотра. Для оформления заказов оформите подписку — {price} Stars на {days} дней.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => {
              haptic.select();
              navigate('/subscribe');
            }}
            className="flex-1 py-2 rounded-xl bg-tg-button text-tg-buttonText text-sm font-semibold active:scale-95 transition-transform"
          >
            Оформить подписку
          </button>
          <button
            onClick={() => navigate('/legal/offer')}
            className="px-3 py-2 rounded-xl bg-tg-secondary-bg text-tg-hint text-xs font-medium active:scale-95 transition-transform"
          >
            Оферта
          </button>
        </div>
      </div>
    </div>
  );
}
