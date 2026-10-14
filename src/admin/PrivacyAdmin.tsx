import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { AdminHeader, AdminNotice } from "./AdminUI";
import {
  privacyKinds,
  privacyStatuses,
  type PrivacyOperator,
} from "../lib/privacy";
import { formatDate } from "../utils/format";
interface Request {
  id: number;
  kind: keyof typeof privacyKinds;
  user_id: number;
  display_name: string;
  first_name: string;
  email: string;
  message: string;
  status: keyof typeof privacyStatuses;
  reply: string;
  created_at: string;
}
const empty: PrivacyOperator = {
  operator_name: "",
  inn: "",
  address: "",
  contact_email: "",
  retention: "",
  recipients: "",
};
export function PrivacyAdmin() {
  const [form, setForm] = useState(empty),
    [requests, setRequests] = useState<Request[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async () => {
    const d = await apiFetch("/api/privacy?admin=1");
    if (!d.ok) throw Error(d.error);
    setForm(d.operator);
    setRequests(d.requests);
  };
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const send = async (body: unknown, success: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const d = await apiFetch("/api/privacy", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!d.ok) throw Error(d.error);
      setSaved(success);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminHeader
        title="Персональные данные"
        subtitle="Реквизиты оператора и обращения покупателей — только для владельца"
      />
      <AdminNotice tone="info">
        Заполнение полей публикует сведения в политике. Оно не подтверждает
        локализацию, подачу уведомлений РКН или соответствие 152-ФЗ. Запрос
        удаления не удаляет данные автоматически: сначала определите законные
        сроки хранения и выполните необходимые действия.
      </AdminNotice>
      {error && <AdminNotice>{error}</AdminNotice>}
      {saved && <AdminNotice tone="success">{saved}</AdminNotice>}
      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <>
          <form
            className="admin-card space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(
                { action: "settings", ...form },
                "Реквизиты и условия опубликованы в политике.",
              );
            }}
          >
            <h2>Данные владельца магазина</h2>
            <div className="admin-form-grid">
              {[
                ["operator_name", "Название организации или ФИО ИП", 300],
                ["inn", "ИНН", 12],
                ["address", "Адрес оператора", 500],
                ["contact_email", "Email для запросов по данным", 254],
              ].map(([key, label, max]) => (
                <label key={String(key)}>
                  {label}
                  <input
                    type={key === "contact_email" ? "email" : "text"}
                    className="admin-input"
                    value={form[key as keyof PrivacyOperator] || ""}
                    maxLength={Number(max)}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="block">
              Получатели данных и подключённые сервисы
              <textarea
                className="admin-input mt-2"
                rows={5}
                maxLength={5000}
                value={form.recipients}
                onChange={(e) =>
                  setForm({ ...form, recipients: e.target.value })
                }
                placeholder="Перечислите фактических исполнителей: хостинг, платежи, доставка, геокодирование. Укажите цели и объём передачи, страны и договорные основания."
              />
            </label>
            <label className="block">
              Сроки хранения и уничтожение
              <textarea
                className="admin-input mt-2"
                rows={5}
                maxLength={5000}
                value={form.retention}
                onChange={(e) =>
                  setForm({ ...form, retention: e.target.value })
                }
                placeholder="Укажите утверждённые сроки по аккаунтам, заказам, обращениям и журналам; порядок удаления и резервных копий. Согласуйте с юристом и бухгалтером."
              />
            </label>
            <button className="admin-primary" disabled={busy}>
              Сохранить и опубликовать
            </button>
          </form>
          <section className="admin-card space-y-4 mt-6">
            <h2>Обращения покупателей</h2>
            <p className="text-sm text-gray-600">
              Проверяйте регулярно. «Ответ дан» означает только публикацию
              ответа — система сама не удаляет аккаунт и не подтверждает
              исполнение требования. История изменения статусов фиксируется на
              сервере.
            </p>
            {!requests.length && <p>Обращений пока нет.</p>}
            {requests.map((r) => (
              <form
                key={r.id}
                className="border rounded-xl p-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(
                    {
                      action: "respond",
                      id: Number(r.id),
                      status: r.status,
                      reply: r.reply,
                    },
                    "Ответ и статус сохранены. Пользователь увидит их в личном кабинете.",
                  );
                }}
              >
                <h3 className="font-semibold">
                  №{r.id} · {privacyKinds[r.kind]}
                </h3>
                <p className="text-sm">
                  {formatDate(new Date(r.created_at).getTime())} · Пользователь
                  #{r.user_id} ·{" "}
                  {r.display_name || r.first_name || r.email || "Без имени"}
                </p>
                {r.message && (
                  <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                )}
                <label className="block text-sm">
                  Статус
                  <select
                    className="admin-input"
                    value={r.status}
                    onChange={(e) =>
                      setRequests(
                        requests.map((x) =>
                          x.id === r.id
                            ? {
                                ...x,
                                status: e.target.value as Request["status"],
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    {Object.entries(privacyStatuses).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Ответ покупателю
                  <textarea
                    className="admin-input"
                    rows={4}
                    maxLength={5000}
                    value={r.reply}
                    onChange={(e) =>
                      setRequests(
                        requests.map((x) =>
                          x.id === r.id ? { ...x, reply: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <button disabled={busy} className="admin-primary">
                  Сохранить ответ
                </button>
              </form>
            ))}
          </section>
        </>
      )}
    </>
  );
}
