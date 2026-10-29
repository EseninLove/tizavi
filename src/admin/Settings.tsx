import { Link } from "react-router-dom";
import { authApi } from "./api";
import { useState } from "react";
import { seedApi } from "./api";

export function Settings() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const handleSeed = async () => {
    if (
      !window.confirm(
        "Заполнить каталог стартовыми товарами? Используйте эту операцию только при первоначальной настройке магазина.",
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const res = await seedApi.init();
      setResult({
        ok: res.ok,
        message: res.ok
          ? res.message +
            (res.adminAdded ? " (админ добавлен)" : "") +
            `, ${res.productsSeeded} товаров`
          : `${res.error}${res.detail ? ": " + res.detail : ""}`,
      });
    } catch {
      setResult({ ok: false, message: "Ошибка соединения" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>

      {authApi.role() === "super_admin" && (
        <section className="admin-card">
          <h2>Почтовый сервис</h2>
          <p className="admin-hint mb-4">
            Регистрация по email работает без подтверждения. Отправка писем пока
            отключена.
          </p>
          <Link className="admin-primary" to="/admin/email">
            Настроить подключение почтового сервиса
          </Link>
        </section>
      )}
      {authApi.role() === "super_admin" && (
        <details className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <summary className="font-semibold cursor-pointer">
            Первоначальная настройка магазина
          </summary>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Инициализация базы данных
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Создаёт таблицы и заполняет каталог товарами по умолчанию.
              Выполняется один раз.
            </p>
          </div>

          <p className="text-sm text-gray-500">
            Доступно только владельцу при временном включении первоначального
            заполнения на сервере. Сотрудники добавляются в разделе
            «Сотрудники».
          </p>

          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Инициализация..." : "Инициализировать БД"}
          </button>

          {result && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"}`}
            >
              {result.message}
            </div>
          )}
        </details>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Переменные окружения
        </h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <code className="text-gray-500">BOT_TOKEN</code>
            <span className="text-gray-400">Токен бота от @BotFather</span>
          </div>
          <div className="flex justify-between">
            <code className="text-gray-500">ADMIN_KEY</code>
            <span className="text-gray-400">Ключ для входа в админку</span>
          </div>
          <div className="flex justify-between">
            <code className="text-gray-500">POSTGRES_URL</code>
            <span className="text-gray-400">Подключается автоматически</span>
          </div>
        </div>
      </div>
    </div>
  );
}
