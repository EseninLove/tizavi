import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { AdminHeader, AdminNotice, AdminBadge } from "./AdminUI";
interface MailForm {
  provider: string;
  host: string;
  port: number;
  username: string;
  sender: string;
  security: string;
  password_saved?: boolean;
}
const defaults: MailForm = {
  provider: "smtp",
  host: "",
  port: 465,
  username: "",
  sender: "",
  security: "tls",
};
export function EmailSettingsAdmin() {
  const [form, setForm] = useState<MailForm>(defaults),
    [password, setPassword] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [canStore, setCanStore] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/api/email-settings");
      if (!d.ok) throw new Error(d.error);
      setForm(d.settings);
      setCanStore(d.canStoreCredentials);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Настройки недоступны");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const provider = (value: string) => {
    setPassword("");
    setSaved("");
    setForm({
      ...form,
      provider: value,
      host:
        value === "yandex"
          ? "smtp.yandex.ru"
          : value === "mailru"
            ? "smtp.mail.ru"
            : "",
      port: 465,
      security: "tls",
    });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const d = await apiFetch("/api/email-settings", {
        method: "PUT",
        body: JSON.stringify({ ...form, password }),
      });
      if (!d.ok) throw new Error(d.error);
      setForm(d.settings);
      setPassword("");
      setSaved("Настройки сохранены. Отправка писем пока отключена.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить настройки",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <AdminHeader
        title="Почтовый сервис"
        subtitle="Настройки для будущих писем о регистрации и восстановлении пароля"
      />
      <div className="admin-row-actions mb-5">
        <AdminBadge tone="warning">Отправка писем не подключена</AdminBadge>
        <AdminBadge>Подтверждение email отключено</AdminBadge>
      </div>
      <AdminNotice tone="info">
        Покупатели регистрируются и входят сразу по email и паролю. Эти
        настройки сохраняются для будущего подключения. Сейчас письма не
        отправляются и соединение с SMTP не проверяется.
      </AdminNotice>
      {error && <AdminNotice>{error}</AdminNotice>}
      {saved && <AdminNotice tone="success">{saved}</AdminNotice>}
      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <form className="admin-card space-y-5" onSubmit={save}>
          <h2>Подключение сервиса</h2>
          <div className="admin-form-grid">
            <label>
              Сервис
              <select
                className="admin-input"
                value={form.provider}
                onChange={(e) => provider(e.target.value)}
              >
                <option value="smtp">SMTP — другой сервис</option>
                <option value="yandex">Яндекс — SMTP</option>
                <option value="mailru">Mail.ru — SMTP</option>
              </select>
            </label>
            <label>
              SMTP-сервер
              <input
                className="admin-input"
                value={form.host}
                placeholder="smtp.example.com"
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </label>
            <label>
              Порт
              <input
                type="number"
                min={1}
                max={65535}
                required
                className="admin-input"
                value={form.port}
                onChange={(e) =>
                  setForm({ ...form, port: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Защита соединения
              <select
                className="admin-input"
                value={form.security}
                onChange={(e) => setForm({ ...form, security: e.target.value })}
              >
                <option value="tls">TLS</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </label>
            <label>
              Логин
              <input
                className="admin-input"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Email отправителя
              <input
                type="email"
                className="admin-input"
                value={form.sender}
                onChange={(e) => setForm({ ...form, sender: e.target.value })}
              />
            </label>
            <label>
              Пароль / ключ сервиса
              <input
                type="password"
                autoComplete="new-password"
                className="admin-input"
                disabled={!canStore}
                placeholder={
                  form.password_saved
                    ? "Сохранён. Пустое поле сохранит прежний пароль"
                    : "Введите пароль приложения"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>
          <p className="admin-hint">
            Пароль хранится зашифрованным и не возвращается в интерфейс.
            {!canStore
              ? " Для сохранения пароля нужна настройка защиты ключей на сервере."
              : ""}
          </p>
          <button className="admin-primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить настройки подключения"}
          </button>
        </form>
      )}
    </div>
  );
}
