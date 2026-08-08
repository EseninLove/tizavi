import { useEffect, useState } from 'react';
import { usersApi } from './api';
import { formatPrice, formatDate } from '../utils/format';

interface UserRow {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  orders_count: number;
  total_spent: number;
  created_at: string;
  last_seen: string;
}

export function UsersAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.list().then((res) => {
      if (res.ok) setUsers(res.users);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Пользователи <span className="text-gray-400 text-lg">({users.length})</span>
      </h1>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">Загрузка...</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-2">Пользователей пока нет</p>
          <p className="text-sm text-gray-400">
            Они появятся автоматически, когда кто-то откроет магазин в Telegram
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Telegram ID</th>
                  <th className="px-4 py-3">Заказов</th>
                  <th className="px-4 py-3">Потрачено</th>
                  <th className="px-4 py-3">Был в сети</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.photo_url ? (
                          <img src={u.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                            {(u.first_name?.[0] || '?').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {[u.first_name, u.last_name].filter(Boolean).join(' ') || 'Без имени'}
                          </div>
                          {u.username && <div className="text-xs text-gray-400">@{u.username}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.telegram_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{u.orders_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatPrice(u.total_spent || 0)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(new Date(u.last_seen).getTime())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center gap-3">
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                    {(u.first_name?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || 'Без имени'}
                  </div>
                  {u.username && <div className="text-xs text-gray-400">@{u.username}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {u.orders_count || 0} зак. · {formatPrice(u.total_spent || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
