import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminsApi } from "./api";
import { formatDate } from "../utils/format";
import { STAFF_ROLES, staffRoleLabel, isStaffRole } from "../shared/staff";
import { AdminHeader, AdminNotice } from "./AdminUI";
interface AdminRow {
  id: number;
  telegram_id: number;
  name: string;
  role: string;
  created_at: string;
}
const roleOptions = Object.entries(STAFF_ROLES);
export function AdminsAdmin() {
  const [admins, setAdmins] = useState<AdminRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [newId, setNewId] = useState(""),
    [newName, setNewName] = useState(""),
    [newRole, setNewRole] = useState("order_manager"),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<AdminRow | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminsApi.list();
      if (!r.ok) throw new Error(r.error);
      setAdmins(r.admins);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить сотрудников",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const validId =
    /^[1-9]\d{0,15}$/.test(newId.trim()) &&
    Number.isSafeInteger(Number(newId.trim()));
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");
    if (!validId) {
      setError("Введите Telegram ID: только цифры, без @ и имени пользователя");
      return;
    }
    if (!newName.trim()) {
      setError("Укажите имя сотрудника");
      return;
    }
    setBusy(true);
    try {
      const r = await adminsApi.add(
        Number(newId.trim()),
        newRole,
        newName.trim(),
      );
      if (!r.ok) throw new Error(r.error);
      setNewId("");
      setNewName("");
      setSuccess("Сотрудник добавлен. Теперь он может войти через Telegram.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось добавить сотрудника",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (!editing.name.trim()) throw new Error("Укажите имя сотрудника");
      const r = await adminsApi.update(
        editing.id,
        editing.name.trim(),
        editing.role,
      );
      if (!r.ok) throw new Error(r.error);
      setEditing(null);
      setSuccess(
        "Изменения сохранены. Если роль изменилась, сотруднику нужно войти заново.",
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить сотрудника",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: AdminRow) => {
    if (
      busy ||
      !window.confirm(
        `Удалить доступ сотрудника «${row.name || row.telegram_id}»? Его текущие сессии будут завершены.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await adminsApi.remove(row.id);
      if (!r.ok) throw new Error(r.error);
      if (editing?.id === row.id) setEditing(null);
      setSuccess("Доступ сотрудника удалён.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось удалить сотрудника",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <AdminHeader
        title="Сотрудники"
        subtitle="Распределяйте обязанности и предоставляйте доступ только к нужным разделам."
      />
      {error && <AdminNotice>{error}</AdminNotice>}
      {success && <AdminNotice tone="success">{success}</AdminNotice>}
      <section className="admin-card">
        <h2 className="mb-4">Новый сотрудник</h2>
        <form onSubmit={add} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Имя сотрудника
              <input
                className="admin-input mt-1"
                autoComplete="off"
                placeholder="Например, Анна Иванова"
                value={newName}
                maxLength={100}
                required
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Telegram ID
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Например, 123456789"
                value={newId}
                maxLength={16}
                required
                onChange={(e) => setNewId(e.target.value)}
              />
              <span className="admin-hint">
                Числовой ID аккаунта, не @username.
              </span>
            </label>
          </div>
          <label className="block text-sm">
            Должность и права
            <select
              className="admin-input mt-1"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              {roleOptions.map(([value, r]) => (
                <option key={value} value={value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-hint" aria-live="polite">
            {isStaffRole(newRole) && STAFF_ROLES[newRole].description}
          </p>
          <button
            className="admin-primary"
            disabled={busy || !validId || !newName.trim()}
            type="submit"
          >
            {busy ? "Сохраняем…" : "Добавить сотрудника"}
          </button>
        </form>
        <p className="admin-hint mt-4">
          После добавления сотрудник открывает магазин в Telegram, переходит в
          профиль → «Панель сотрудников» и нажимает «Войти через Telegram».
          Общий ключ владельца ему не нужен. Свой числовой ID можно узнать у
          @userinfobot.
        </p>
      </section>
      <section className="admin-card">
        <h2 className="mb-4">Команда магазина</h2>
        {loading ? (
          <p className="admin-hint">Загружаем сотрудников…</p>
        ) : admins.length === 0 ? (
          <p className="admin-hint">
            Сотрудников пока нет. Добавьте первого в форме выше.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {admins.map((row) => (
              <div key={row.id} className="py-4">
                {editing?.id === row.id ? (
                  <div className="space-y-3">
                    <label className="block text-sm">
                      Имя
                      <input
                        className="admin-input mt-1"
                        value={editing.name}
                        maxLength={100}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Роль
                      <select
                        className="admin-input mt-1"
                        value={editing.role}
                        onChange={(e) =>
                          setEditing({ ...editing, role: e.target.value })
                        }
                      >
                        {roleOptions.map(([value, r]) => (
                          <option key={value} value={value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="admin-hint">
                      {isStaffRole(editing.role) &&
                        STAFF_ROLES[editing.role].description}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="admin-primary"
                        onClick={() => void save()}
                        disabled={busy}
                      >
                        Сохранить
                      </button>
                      <button
                        className="admin-button"
                        disabled={busy}
                        onClick={() => setEditing(null)}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold break-words">
                        {row.name || `Сотрудник ${row.telegram_id}`}
                      </h3>
                      <p className="admin-hint">
                        Telegram ID: {row.telegram_id} · Добавлен{" "}
                        {formatDate(new Date(row.created_at).getTime())}
                      </p>
                      <span className="admin-badge mt-2">
                        {staffRoleLabel(row.role)}
                      </span>
                    </div>
                    <button
                      className="admin-button"
                      disabled={busy}
                      onClick={() => {
                        setEditing({ ...row, name: row.name || "" });
                        setError("");
                        setSuccess("");
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      className="admin-button text-red-600"
                      disabled={busy}
                      onClick={() => void remove(row)}
                    >
                      Удалить доступ
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
