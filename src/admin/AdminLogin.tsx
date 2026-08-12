import { useState } from 'react';
import { authApi } from './api';

interface AdminLoginProps {
  onLogin: () => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeyLogin = async () => {
    if (!adminKey.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      const data = await authApi.loginWithKey(adminKey.trim());
      if (data.ok) {
        onLogin();
      } else {
        setError(data.error || 'Неизвестная ошибка');
      }
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const testApi = async () => {
    setError('');
    try {
      const res = await fetch('/api/ping');
      const text = await res.text();
      setError(`Тест API [${res.status}]: ${text}`);
    } catch (err) {
      setError(`API недоступен: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const testDb = async () => {
    setError('');
    try {
      const res = await fetch('/api/db-test');
      const text = await res.text();
      setError(`Тест БД [${res.status}]: ${text}`);
    } catch (err) {
      setError(`БД недоступна: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🛒</div>
          <h1 className="text-2xl font-bold text-gray-900">Tizavi Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Панель управления магазином</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ключ администратора
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
              placeholder="Введите ключ..."
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleKeyLogin()}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 max-h-32 overflow-y-auto break-all">
              {error}
            </div>
          )}

          <button
            onClick={handleKeyLogin}
            disabled={!adminKey.trim() || loading}
            className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? 'Проверка...' : 'Войти'}
          </button>

          <button
            onClick={testApi}
            className="w-full text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Проверить соединение с API
          </button>

          <button
            onClick={testDb}
            className="w-full text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Проверить соединение с БД
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Ключ задаётся в переменной окружения <code className="text-gray-500">ADMIN_KEY</code>
        </p>
      </div>
    </div>
  );
}
