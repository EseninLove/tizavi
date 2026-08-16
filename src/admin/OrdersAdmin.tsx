import { useEffect, useState } from 'react';
import { ordersApi } from './api';
import { formatPrice, formatDate } from '../utils/format';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Оплачен', color: 'bg-green-100 text-green-700' },
  shipped: { label: 'Отправлен', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Доставлен', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
};

const STATUS_FLOW = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

interface OrderRow {
  id: number;
  order_number: string;
  items: Array<{ product_id: string; product: { name: string; image: string; price: number }; quantity: number }>;
  total: number;
  delivery: { name: string; phone: string; address: string; city: string; comment?: string; deliveryType: string };
  payment_method: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  created_at: string;
}

export function OrdersAdmin() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const load = (status?: string) => {
    setLoading(true);
    ordersApi.list(status).then((res) => {
      if (res.ok) setOrders(res.orders);
      setLoading(false);
    });
  };

  useEffect(() => {
    load(filter === 'all' ? undefined : filter);
  }, [filter]);

  const updateStatus = async (id: number, status: string) => {
    const res = await ordersApi.updateStatus(id, status);
    if (res.ok) {
      setSelected(null);
      load(filter === 'all' ? undefined : filter);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Заказы <span className="text-gray-400 text-lg">({orders.length})</span>
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <FilterChip label="Все" active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUS_FLOW.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_LABELS[s]?.label || s}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Заказов нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const info = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div
                key={order.id}
                onClick={() => setSelected(order)}
                className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-gray-300 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900">{order.order_number}</div>
                    <div className="text-xs text-gray-400">{formatDate(new Date(order.created_at).getTime())}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${info.color}`}>
                    {info.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-600">
                      {(order.customer_name || order.delivery?.name) || 'Гость'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {order.items?.length || 0} тов. · 💳 Карта
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-900 shrink-0">
                    {formatPrice(order.total + (order.total >= 5000 ? 0 : 290))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{selected.order_number}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Статус:</span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${(STATUS_LABELS[selected.status] || {}).color || 'bg-gray-100'}`}>
                  {(STATUS_LABELS[selected.status] || {}).label || selected.status}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Состав заказа</h3>
                <div className="space-y-2">
                  {selected.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {item.product?.image && (
                        <img src={item.product.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{item.product?.name || 'Товар'}</div>
                        <div className="text-xs text-gray-400">{item.quantity} шт.</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm font-semibold text-gray-700">Сумма</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatPrice(selected.total + (selected.total >= 5000 ? 0 : 290))}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Доставка</h3>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
                  <div className="text-gray-900">{selected.delivery?.name || selected.customer_name}</div>
                  <div className="text-gray-500">{selected.delivery?.phone || selected.customer_phone}</div>
                  {selected.delivery?.deliveryType === 'courier' && (
                    <div className="text-gray-500">
                      {selected.delivery?.city}, {selected.delivery?.address}
                    </div>
                  )}
                  {selected.delivery?.deliveryType === 'pickup' && (
                    <div className="text-gray-500">Самовывоз</div>
                  )}
                  {selected.delivery?.comment && (
                    <div className="text-gray-400 italic mt-1">«{selected.delivery.comment}»</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Изменить статус</h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW.map((s) => {
                    const info = STATUS_LABELS[s];
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                          selected.status === s
                            ? info.color + ' ring-2 ring-offset-1 ring-gray-300'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${
        active ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
