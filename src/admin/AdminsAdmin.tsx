import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { adminsApi } from "./api";
import { formatDate } from "../utils/format";
import { STAFF_ROLES, staffRoleLabel, isStaffRole } from "../shared/staff";
import { AdminHeader, AdminNotice } from "./AdminUI";
interface Account {
  id: number;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
}
interface Staff {
  id: number;
  user_id: number | null;
  name: string;
  email?: string;
  username?: string;
  role: string;
  created_at: string;
}
const accountName = (u: Account) =>
  u.display_name ||
  [u.first_name, u.last_name].filter(Boolean).join(" ") ||
  u.email ||
  (u.username ? `@${u.username}` : `Пользователь №${u.id}`);
const identity = (u: { email?: string; username?: string }) =>
  [u.email, u.username ? `@${u.username}` : ""].filter(Boolean).join(" · ");
const roleOptions = Object.entries(STAFF_ROLES);
export function AdminsAdmin() {
  const [staff, setStaff] = useState<Staff[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [users, setUsers] = useState<Account[]>([]),
    [hasMore, setHasMore] = useState(false),
    [searching, setSearching] = useState(true),
    [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<Account | null>(null),
    [role, setRole] = useState("order_manager"),
    [editing, setEditing] = useState<Staff | null>(null),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const request = useRef(0);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminsApi.list();
      if (!r.ok) throw new Error(r.error);
      setStaff(r.admins);
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
  useEffect(() => {
    const generation = ++request.current;
    setSearching(true);
    setSearchError("");
    const timer = window.setTimeout(() => {
      adminsApi
        .candidates(query, page)
        .then((r) => {
          if (generation !== request.current) return;
          if (!r.ok) throw new Error(r.error);
          setUsers(r.users);
          setHasMore(r.hasMore);
        })
        .catch((e) => {
          if (generation === request.current) {
            setUsers([]);
            setHasMore(false);
            setSearchError(
              e instanceof Error
                ? e.message
                : "Не удалось загрузить пользователей",
            );
          }
        })
        .finally(() => {
          if (generation === request.current) setSearching(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ++request.current;
    };
  }, [query, page, revision]);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await adminsApi.add(selected.id, role);
      if (!r.ok) throw new Error(r.error);
      setSuccess(
        `Права выданы: ${accountName(selected)}. Кнопка панели появится в его профиле после обновления.`,
      );
      setSelected(null);
      setRevision((v) => v + 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выдать права");
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
      const r = await adminsApi.update(editing.id, editing.role);
      if (!r.ok) throw new Error(r.error);
      setEditing(null);
      setSuccess(
        "Роль изменена. Название панели в профиле обновится при следующем обращении к серверу.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить роль");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: Staff) => {
    if (
      busy ||
      !window.confirm(
        `Отозвать права сотрудника «${row.name}»? Его учётная запись покупателя и заказы сохранятся.`,
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
      setSuccess("Права сотрудника отозваны. Аккаунт покупателя сохранён.");
      setRevision((v) => v + 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отозвать права");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <AdminHeader
        title="Сотрудники"
        subtitle="Выберите пользователя магазина и назначьте ему рабочую роль."
      />
      {error && <AdminNotice>{error}</AdminNotice>}
      {success && <AdminNotice tone="success">{success}</AdminNotice>}
      <section className="admin-card">
        <h2 className="mb-4">Выдать права пользователю</h2>
        <form onSubmit={add} className="space-y-4">
          <label className="block text-sm">
            Найти пользователя
            <input
              className="admin-input mt-1"
              type="search"
              autoComplete="off"
              placeholder="Имя, email или имя в Telegram"
              value={query}
              maxLength={100}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <p className="admin-hint">
            В списке — пользователи магазина, которым ещё не выданы права
            сотрудника. Если человека нет, попросите его сначала войти на сайт
            или открыть магазин в Telegram.
          </p>
          {searchError ? (
            <AdminNotice>
              {searchError}
              <button
                type="button"
                className="admin-button ml-2"
                onClick={() => setRevision((v) => v + 1)}
              >
                Повторить
              </button>
            </AdminNotice>
          ) : searching ? (
            <p className="admin-hint" role="status">
              Загружаем пользователей…
            </p>
          ) : users.length ? (
            <fieldset
              className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200"
              aria-label="Зарегистрированные пользователи"
            >
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="staff-user"
                    value={u.id}
                    checked={selected?.id === u.id}
                    disabled={busy}
                    onChange={() => setSelected(u)}
                  />
                  <span className="min-w-0">
                    <strong className="block text-sm break-words">
                      {accountName(u)}
                    </strong>
                    <span className="admin-hint break-all">
                      {identity(u) || `Учётная запись №${u.id}`}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="admin-hint">
              {query
                ? "Пользователи не найдены. Попробуйте другое имя или email."
                : "Пока нет пользователей без прав сотрудника."}
            </p>
          )}
          {(page > 0 || hasMore) && (
            <div className="flex gap-2">
              <button
                className="admin-button"
                type="button"
                disabled={searching || page === 0}
                onClick={() => setPage((v) => v - 1)}
              >
                Назад
              </button>
              <span className="admin-hint">Страница {page + 1}</span>
              <button
                className="admin-button"
                type="button"
                disabled={searching || !hasMore}
                onClick={() => setPage((v) => v + 1)}
              >
                Далее
              </button>
            </div>
          )}
          {selected && (
            <div className="rounded-xl bg-green-50 p-3 text-sm">
              <strong>Выбран: {accountName(selected)}</strong>
              <p className="break-all">{identity(selected)}</p>
              <button
                type="button"
                className="text-sm underline mt-1"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Снять выбор
              </button>
            </div>
          )}
          <label className="block text-sm">
            Роль и права
            <select
              className="admin-input mt-1"
              value={role}
              disabled={busy}
              onChange={(e) => setRole(e.target.value)}
            >
              {roleOptions.map(([value, r]) => (
                <option key={value} value={value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-hint" aria-live="polite">
            {isStaffRole(role) && STAFF_ROLES[role].description}
          </p>
          <button
            className="admin-primary"
            type="submit"
            disabled={busy || !selected}
          >
            {busy ? "Сохраняем…" : "Выдать права"}
          </button>
        </form>
        <p className="admin-hint mt-4">
          Сотрудник входит в свой обычный профиль и открывает рабочую панель
          оттуда. Подходит вход через email и Telegram. Отдельный ключ владельца
          ему не нужен.
        </p>
      </section>
      <section className="admin-card">
        <h2 className="mb-4">Команда магазина · {staff.length}</h2>
        {loading ? (
          <p className="admin-hint">Загружаем сотрудников…</p>
        ) : !staff.length ? (
          <p className="admin-hint">Права ещё никому не выданы.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {staff.map((row) => (
              <div key={row.id} className="py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold break-words">{row.name}</h3>
                    <p className="admin-hint break-all">
                      {identity(row)} · С{" "}
                      {formatDate(new Date(row.created_at).getTime())}
                    </p>
                    <span className="admin-badge mt-2">
                      {staffRoleLabel(row.role)}
                    </span>
                    {!row.user_id && (
                      <p className="admin-hint">
                        Старый доступ через Telegram сохранён. Учётная запись
                        привяжется после входа сотрудника.
                      </p>
                    )}
                  </div>
                  <button
                    className="admin-button"
                    disabled={busy}
                    onClick={() => {
                      setEditing({ ...row });
                      setError("");
                      setSuccess("");
                    }}
                  >
                    Изменить роль
                  </button>
                  <button
                    className="admin-button text-red-600"
                    disabled={busy}
                    onClick={() => void remove(row)}
                  >
                    Отозвать права
                  </button>
                </div>
                {editing?.id === row.id && (
                  <div className="space-y-3 mt-4">
                    <label className="block text-sm">
                      Роль
                      <select
                        className="admin-input mt-1"
                        value={editing.role}
                        disabled={busy}
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
                        disabled={busy}
                        onClick={() => void save()}
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
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
