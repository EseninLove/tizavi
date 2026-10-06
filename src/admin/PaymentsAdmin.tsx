import { useEffect, useState } from "react";
import { apiFetch } from "./api";
interface Provider {
  id: string;
  name: string;
  fields: string[];
  connected: boolean;
}
interface Settings {
  ok: boolean;
  activeProvider: string;
  publicUrl: string;
  allowTest: boolean;
  canStoreCredentials: boolean;
  providers: Provider[];
}
const fieldLabels: Record<string, string> = {
  shopId: "ID магазина",
  secretKey: "Секретный ключ",
  terminalKey: "Ключ терминала",
  password: "Пароль терминала",
};
export function PaymentsAdmin() {
  const [data, setData] = useState<Settings | null>(null),
    [provider, setProvider] = useState("yookassa"),
    [url, setUrl] = useState(""),
    [test, setTest] = useState(false),
    [credentials, setCredentials] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const d = await apiFetch("/api/payment-settings");
      if (!d.ok) throw new Error(d.error);
      setData(d);
      setProvider(d.activeProvider);
      setUrl(d.publicUrl);
      setTest(d.allowTest);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить настройки",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const selected = data?.providers.find((p) => p.id === provider);
  const save = async (activate: boolean) => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const d = await apiFetch("/api/payment-settings", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          credentials,
          publicUrl: url,
          allowTest: test,
          activate,
        }),
      });
      if (!d.ok) throw new Error(d.error);
      setData(d);
      setCredentials({});
      setSaved(
        activate
          ? "Агрегатор выбран для новых платежей"
          : "Настройки подключения сохранены",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5 text-gray-900">
      <h1 className="text-2xl font-bold">Оплата</h1>
      <p className="text-sm text-gray-600">
        Подписка и товары оплачиваются через один выбранный агрегатор. Уже
        созданные платежи проверяются через тот сервис, в котором они были
        созданы.
      </p>
      {error && (
        <p role="alert" className="text-red-600 bg-red-50 p-3 rounded-xl">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-green-700 bg-green-50 p-3 rounded-xl">
          {saved}
        </p>
      )}
      {data && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.providers.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setCredentials({});
                }}
                className={`bg-white rounded-xl border p-4 text-left ${provider === p.id ? "border-green-600 ring-1 ring-green-600" : "border-gray-200"}`}
              >
                <strong>{p.name}</strong>
                <p className="text-xs text-gray-500 mt-1">
                  {p.connected ? "Ключи сохранены" : "Ключи не добавлены"}
                  {data.activeProvider === p.id ? " · Выбран для оплаты" : ""}
                </p>
              </button>
            ))}
          </div>
          <section className="bg-white border rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold">Подключение {selected?.name}</h2>
            <div className="admin-setup-steps">
              <span className="active">1. Ключи</span>
              <span>2. Уведомления</span>
              <span>3. Активация</span>
            </div>
            <p className="admin-hint">
              Сохранение ключей не подтверждает связь с агрегатором. После
              настройки проведите тестовую оплату.
            </p>
            <label className="block text-sm">
              Адрес опубликованного магазина
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="admin-input mt-1"
                placeholder="https://your-shop.ru"
              />
            </label>
            {!data.canStoreCredentials && (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl">
                Сохранение ключей станет доступно после настройки защиты на
                сервере. Подключённые через сервер ключи можно использовать уже
                сейчас. Инструкция — в документации проекта.
              </p>
            )}
            {selected?.fields.map((field) => (
              <label key={field} className="block text-sm">
                {fieldLabels[field]}
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={!data.canStoreCredentials}
                  value={credentials[field] || ""}
                  onChange={(e) =>
                    setCredentials({ ...credentials, [field]: e.target.value })
                  }
                  placeholder={
                    selected.connected
                      ? "Сохранён. Оставьте пустым, чтобы сохранить"
                      : "Введите ключ"
                  }
                  className="admin-input mt-1"
                />
              </label>
            ))}
            <p className="text-xs text-gray-500">
              Ключи хранятся зашифрованными и не возвращаются в интерфейс. Для
              замены заполните оба поля.
            </p>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={test}
                onChange={(e) => setTest(e.target.checked)}
              />
              Разрешить тестовые платежи ЮKassa для проверки подключения
            </label>
            <p className="text-xs text-gray-500">
              Перед приёмом настоящих заказов выключите тестовый режим. Для
              Т-Банка используйте рабочий терминал после тестирования в
              отдельном магазине.
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => void save(false)}
                className="px-4 py-3 bg-gray-100 rounded-xl font-semibold text-sm"
              >
                Сохранить подключение
              </button>
              <button
                disabled={busy}
                onClick={() => void save(true)}
                className="px-4 py-3 bg-green-700 text-white rounded-xl font-semibold text-sm"
              >
                Использовать для оплаты
              </button>
            </div>
          </section>
          <section className="bg-white border rounded-2xl p-5 space-y-2">
            <h2 className="font-semibold">Подтверждение платежей</h2>
            <p className="text-sm text-gray-600">
              Адрес уведомлений для агрегатора:
            </p>
            <code className="block bg-gray-50 p-3 rounded-xl text-xs break-all">
              {url
                ? `${url.replace(/\/$/, "")}/api/payment-webhook`
                : "Сначала укажите адрес магазина"}
            </code>
            <p className="text-sm text-gray-600">
              Для ЮKassa включите события payment.succeeded и payment.canceled.
              Для Т-Банка адрес передаётся при создании платежа. Магазин
              дополнительно запрашивает статус у агрегатора и проверяет сумму.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
