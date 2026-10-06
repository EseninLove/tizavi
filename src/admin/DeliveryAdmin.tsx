import { useEffect, useState } from "react";
import { apiFetch } from "./api";
type Row = Record<string, string | number | boolean>;
const warehouseDefault: Row = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_km: 30,
  preparation_minutes: 30,
  open_hour: 9,
  close_hour: 22,
  active: true,
};
const courierDefault: Row = {
  name: "",
  phone: "",
  warehouse_id: "",
  active: true,
};
const labels: Record<string, string> = {
  name: "Название / имя",
  address: "Адрес",
  latitude: "Широта",
  longitude: "Долгота",
  radius_km: "Радиус доставки, км",
  preparation_minutes: "Сборка, минут",
  open_hour: "Открытие, час",
  close_hour: "Закрытие, час",
  phone: "Телефон",
  base_fee: "Базовая доставка, ₽",
  per_km: "Доплата за км, ₽",
  free_from: "Бесплатно от суммы товаров, ₽",
  speed_kmh: "Средняя скорость, км/ч",
  road_factor: "Коэффициент длины дороги",
};
export function DeliveryAdmin() {
  const [warehouses, setWarehouses] = useState<Row[]>([]),
    [couriers, setCouriers] = useState<Row[]>([]),
    [settings, setSettings] = useState<Row | null>(null),
    [configured, setConfigured] = useState(false),
    [form, setForm] = useState<Row | null>(null),
    [kind, setKind] = useState("warehouse"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("");
  const load = async () => {
    try {
      const d = await apiFetch("/api/delivery-admin");
      if (!d.ok) throw new Error(d.error);
      setWarehouses(d.warehouses);
      setCouriers(d.couriers);
      setSettings(d.settings);
      setConfigured(d.geocodingConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (data: Row, saveKind: string) => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await apiFetch("/api/delivery-admin", {
        method: "POST",
        body: JSON.stringify({ ...data, kind: saveKind }),
      });
      if (!result.ok) throw new Error(result.error);
      setForm(null);
      await load();
      setSaved("Настройки доставки сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5 text-gray-900">
      <h1 className="text-2xl font-bold">Доставка</h1>
      <p className="text-sm text-gray-600">
        Москва и Московская область. Выбирается ближайший активный склад в
        радиусе обслуживания с активным курьером. Время предварительное, без
        пробок: расстояние по координатам × коэффициент дороги, плюс время
        сборки. Часы работы указаны по Москве.
      </p>
      <p
        className={`text-sm p-3 rounded-xl ${configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
      >
        {configured
          ? "Проверка адресов подключена"
          : "Проверка адресов пока не подключена. После настройки DaData покупатели смогут выбирать адреса и получать расчёт."}
      </p>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-green-700">
          {saved}
        </p>
      )}
      {[
        ["warehouse", "Склады", warehouses],
        ["courier", "Курьеры", couriers],
      ].map(([type, title, rows]) => (
        <section key={String(type)} className="bg-white border rounded-2xl p-5">
          <div className="flex justify-between">
            <h2 className="font-semibold">{String(title)}</h2>
            <button
              onClick={() => {
                setKind(String(type));
                setForm({
                  ...(type === "warehouse" ? warehouseDefault : courierDefault),
                });
              }}
              className="text-sm text-green-700"
            >
              + Добавить
            </button>
          </div>
          {(rows as Row[]).length ? (
            (rows as Row[]).map((row) => (
              <button
                key={String(row.id)}
                onClick={() => {
                  setKind(String(type));
                  setForm(row);
                }}
                className="w-full text-left border-t mt-3 pt-3"
              >
                <span className="font-medium text-sm">{String(row.name)}</span>
                <span className="text-xs text-gray-500 block">
                  {String(row.address || row.phone || "")} ·{" "}
                  {row.active ? "Активен" : "Отключён"}
                  {type === "courier"
                    ? ` · ${warehouses.find((w) => w.id === row.warehouse_id)?.name || "Склад не выбран"}`
                    : ""}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500 mt-3">Пока не добавлены</p>
          )}
        </section>
      ))}
      {settings && (
        <section className="bg-white border rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Тарифы и расчёт</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(settings)
              .filter(([key]) => key !== "id")
              .map(([key, value]) => (
                <label key={key} className="text-sm">
                  {labels[key] || key}
                  <input
                    type="number"
                    step="any"
                    value={String(value)}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: e.target.value })
                    }
                    className="admin-input mt-1"
                  />
                </label>
              ))}
          </div>
          <button
            disabled={busy}
            onClick={() => void save(settings, "settings")}
            className="bg-green-700 text-white rounded-xl px-4 py-3 text-sm"
          >
            Сохранить тариф
          </button>
        </section>
      )}
      {form && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={kind === "warehouse" ? "Склад" : "Курьер"}
          className="fixed inset-0 z-50 bg-black/40 flex justify-center items-center p-4"
          onClick={() => setForm(null)}
        >
          <section
            className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold">
              {kind === "warehouse" ? "Склад" : "Курьер"}
            </h2>
            {Object.entries(form)
              .filter(
                ([key]) => !["id", "active", "warehouse_id"].includes(key),
              )
              .map(([key, value]) => (
                <label key={key} className="block text-sm">
                  {labels[key] || key}
                  <input
                    value={String(value)}
                    type={
                      ["name", "address", "phone"].includes(key)
                        ? "text"
                        : "number"
                    }
                    step="any"
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                    className="admin-input mt-1"
                  />
                </label>
              ))}
            {kind === "courier" && (
              <label className="block text-sm">
                Склад
                <select
                  value={String(form.warehouse_id)}
                  onChange={(e) =>
                    setForm({ ...form, warehouse_id: e.target.value })
                  }
                  className="admin-input mt-1"
                >
                  <option value="">Выберите склад</option>
                  {warehouses.map((w) => (
                    <option key={String(w.id)} value={String(w.id)}>
                      {String(w.name)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active === true}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Активен
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => void save(form, kind)}
                className="bg-green-700 text-white rounded-xl px-4 py-3"
              >
                Сохранить
              </button>
              <button
                onClick={() => setForm(null)}
                className="bg-gray-100 rounded-xl px-4 py-3"
              >
                Закрыть
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
