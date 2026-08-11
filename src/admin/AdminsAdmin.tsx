import { useEffect, useState } from 'react';
import { adminsApi } from './api';
import { formatDate } from '../utils/format';

interface AdminRow {
  id: number;
  telegram_id: number;
  role: string;
  created_at: string;
}

export function AdminsAdmin() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    adminsApi.list().then((res) => {
      if (res.ok) setAdmins(res.admins);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleAdd = async () => {
    if (!newId.trim() || adding) return;
    setAdding(true);
    setError('');

    try {
      const res = await adminsApi.add(Number(newId.trim()), newRole);
      if (res.ok) {
        setNewId('');
        load();
      } else {
        setError(res.error || 'Ошибка');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (admin: AdminRow) => {
    if (!confirm(`Удалить админа ${admin.telegram_id}?`)) return;
    const res = await adminsApi.remove(admin.id);
    if (res.ok) load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Администраторы <span className="text-gray-400 text-lg">({admins.length})</span>
      </h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Добавить админа</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            className="admin-input flex-1"
            placeholder="Telegram ID (например: 123456789)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <select
            className="admin-input sm:w-40"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          >
            <option value="admin">Админ</option>
            <option value="super_admin">Супер-админ</option>
          </select>
        </div>
        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
        <button
          onClick={handleAdd}
          disabled={!newId.trim() || adding}
          className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
        >
          {adding ? 'Добавление...' : '+ Добавить админа'}
        </button>
        <p className="text-xs text-gray-400">
          Узнать Telegram ID: <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-blue-500">@userinfobot</a>
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 animate-pulse">Загрузка...</div>
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Админов пока нет</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {admins.map((admin) => (
              <div key={admin.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {admin.telegram_id.toString().slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono font-medium text-gray-900">
                    {admin.telegram_id}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      admin.role === 'super_admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {admin.role === 'super_admin' ? 'Супер-админ' : 'Админ'}
                    </span>
                    <span className="text-xs text-gray-400">
                      с {formatDate(new Date(admin.created_at).getTime())}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(admin)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0 active:scale-95 transition-all"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
