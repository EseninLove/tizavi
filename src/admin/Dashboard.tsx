import { useEffect, useState } from 'react';
import { dashboardApi } from './api';
import { formatPrice, formatDate, formatNumber } from '../utils/format';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Оплачен', color: 'bg-green-100 text-green-700' },
  shipped: { label: 'Отправлен', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Доставлен', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
};

interface DashboardData {
  stats: {
    products: number;
    orders: number;
    users: number;
    revenue: number;
    statusCounts: Record<string, number>;
  };
  recentOrders: Array<Record<string, unknown>>;
  topProducts: Array<{ name: string; image: string; times_ordered: string }>;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.get().then((res) => {
      if (res.ok) setData(res);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error || 'Ошибка загрузки'}</p>
        <p className="text-sm text-gray-500">
          Возможно, база данных ещё не инициализирована.
          <br />
          Перейдите в раздел «Настройки» и нажмите «Инициализировать БД».
        </p>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📦" label="Товары" value={formatNumber(stats.products)} color="bg-blue-50" />
        <StatCard icon="🛒" label="Заказы" value={formatNumber(stats.orders)} color="bg-purple-50" />
        <StatCard icon="👥" label="Пользователи" value={formatNumber(stats.users)} color="bg-green-50" />
        <StatCard icon="💰" label="Выручка" value={formatPrice(stats.revenue)} color="bg-amber-50" />
      </div>

      {Object.keys(stats.statusCounts).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Заказы по статусам</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.statusCounts).map(([status, count]) => {
              const info = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
              return (
                <span key={status} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${info.color}`}>
                  {info.label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Последние заказы</h2>
          {data.recentOrders.length > 0 ? (
            <div className="space-y-3">
              {data.recentOrders.map((order) => {
                const info = STATUS_LABELS[(order.status as string)] || {
                  label: order.status,
                  color: 'bg-gray-100 text-gray-700',
                };
                return (
                  <div key={order.id as number} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {order.order_number as string}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(order.customer_name as string) || 'Гость'} · {formatDate(order.created_at as number)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${info.color}`}>
                        {info.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(order.total as number)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Заказов пока нет</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Популярные товары</h2>
          {data.topProducts.length > 0 ? (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  </div>
                  <span className="text-sm text-gray-500 shrink-0">
                    ×{parseInt(p.times_ordered, 10)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Нет данных</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${color}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
