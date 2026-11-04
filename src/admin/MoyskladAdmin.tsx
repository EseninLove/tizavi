import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "./api";
import { AdminBadge, AdminHeader, AdminIcon, AdminNotice } from "./AdminUI";
import type {
  MoyskladReference,
  MoyskladReferences,
} from "../../api/_moysklad-client";
interface Connection {
  productsEnabled: boolean;
  productsSyncedAt: string | null;
  productsError: string | null;
  productsSummary: {
    total?: number;
    created?: number;
    unavailable?: number;
    imageErrors?: number;
    issues?: { name: string; error: string }[];
  };
  categoriesEnabled: boolean;
  categoriesSyncedAt: string | null;
  categoriesError: string | null;
  tokenSaved: boolean;
  canStoreCredentials: boolean;
  checkedAt: string | null;
  lastError: string | null;
  configured: boolean;
  catalogCount: number;
  references: MoyskladReferences;
  preview: { id: string; name: string; type: string }[];
  selection: { organizationId: string; storeId: string; priceTypeId: string };
}
async function connectionRequest(options: RequestInit = {}, timeoutMs = 35000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch("/api/moysklad", {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "Операция не завершилась вовремя. Обновите страницу, чтобы узнать, сохранился ли токен, и повторите проверку при необходимости.",
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
export function MoyskladAdmin() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [selection, setSelection] = useState({
    organizationId: "",
    storeId: "",
    priceTypeId: "",
  });
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const apply = (d: Connection) => {
    setConnection(d);
    setSelection(d.selection);
  };
  useEffect(() => {
    let live = true;
    connectionRequest()
      .then((d) => {
        if (!live) return;
        if (!d.ok) throw new Error(d.error);
        apply(d);
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить настройки",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  const change = async (
    action: string,
    method: string,
    body?: Record<string, unknown>,
  ) => {
    if (busy) return;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const d = await connectionRequest(
        {
          method,
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
        action.startsWith("categories-") || action.startsWith("products-")
          ? 120000
          : 35000,
      );
      if (!d.ok) throw new Error(d.error);
      apply(d);
      if (action === "categories-export" || action === "categories-sync")
        setNotice(
          `Категории обновлены. Групп в МоёмСкладе: ${d.categoryResult.groups}. Создано на сайте: ${d.categoryResult.created}. Перенесено в МойСклад: ${d.categoryResult.exported}.`,
        );
      if (action === "products-sync")
        setNotice(
          `Товары обновлены: ${d.productResult.total}. Новых: ${d.productResult.created}. Нет в наличии: ${d.productResult.unavailable}.`,
        );
      if (action === "products-pause")
        setNotice("Автообновление товаров приостановлено.");
      if (action === "categories-pause")
        setNotice("Автообновление категорий приостановлено.");
      if (action === "token") {
        setToken("");
        setNotice(
          "Токен проверен и сохранён. Выберите организацию, склад и тип цен.",
        );
      }
      if (action === "selection")
        setNotice(
          "Параметры подключения сохранены. Следующий шаг — подготовить товары в МоёмСкладе.",
        );
      if (action === "check")
        setNotice(
          "Проверка завершена. Справочники и обзор ассортимента обновлены.",
        );
      if (action === "disconnect") {
        setToken("");
        setNotice("Токен удалён из магазина. Каталог и заказы сохранены.");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось обновить подключение",
      );
    } finally {
      setBusy("");
    }
    // Refresh separately: a stalled refresh must never keep the buttons locked.
    if (action === "check" || action === "products-sync") {
      void connectionRequest()
        .then((d) => {
          if (d.ok) apply(d);
        })
        .catch(() => {});
    }
  };
  const saveToken = (e: FormEvent) => {
    e.preventDefault();
    void change("token", "PUT", { action: "token", token });
  };
  const saveSelection = (e: FormEvent) => {
    e.preventDefault();
    void change("selection", "PUT", { action: "selection", ...selection });
  };
  const select = (
    label: string,
    field: keyof typeof selection,
    rows: MoyskladReference[],
  ) => (
    <label>
      {label}
      <select
        className="admin-input"
        value={selection[field]}
        disabled={!!busy || !connection?.checkedAt || !!connection.lastError}
        onChange={(e) => {
          setSelection({ ...selection, [field]: e.target.value });
          setNotice("");
        }}
        required
      >
        <option value="">
          {rows.length ? "Выберите из МоегоСклада" : "Нет доступных значений"}
        </option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-6">
      <AdminHeader
        title="МойСклад"
        subtitle="Подключение учёта товаров, складов и цен"
      >
        <a
          className="admin-secondary"
          href="https://online.moysklad.ru/"
          target="_blank"
          rel="noreferrer"
        >
          <AdminIcon name="external" />
          Открыть МойСклад
        </a>
      </AdminHeader>
      {error && <AdminNotice>{error}</AdminNotice>}
      {notice && <AdminNotice tone="success">{notice}</AdminNotice>}
      {!connection ? (
        <p className="admin-hint">
          {error
            ? "Обновите страницу после восстановления доступа."
            : "Загружаем подключение…"}
        </p>
      ) : (
        <>
          <section className="admin-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2>Подготовка подключения</h2>
                <p className="admin-hint mt-2">
                  Сначала подключите аккаунт, затем подготовьте каталог в
                  МоёмСкладе.
                </p>
              </div>
              <AdminBadge
                tone={
                  connection.lastError
                    ? "danger"
                    : connection.tokenSaved
                      ? "success"
                      : "neutral"
                }
              >
                {connection.lastError
                  ? "Нужна проверка"
                  : connection.tokenSaved
                    ? "Токен подключён"
                    : "Не подключено"}
              </AdminBadge>
            </div>
            <ol className="grid gap-4 md:grid-cols-3 mt-5">
              <li className="rounded-xl border border-gray-200 p-4">
                <strong>1. Доступ к аккаунту</strong>
                <p className="admin-hint mt-1">
                  {connection.tokenSaved
                    ? "Токен сохранён на сервере."
                    : "Укажите API-токен сотрудника МоегоСклада."}
                </p>
              </li>
              <li className="rounded-xl border border-gray-200 p-4">
                <strong>2. Организация и склад</strong>
                <p className="admin-hint mt-1">
                  {connection.configured
                    ? "Параметры выбраны и сохранены."
                    : "Выберите, откуда получать товары и цены."}
                </p>
              </li>
              <li className="rounded-xl border border-gray-200 p-4">
                <strong>3. Подготовка товаров</strong>
                <p className="admin-hint mt-1">
                  Добавьте товары, цены и начальные остатки в МоёмСкладе.
                </p>
              </li>
            </ol>
          </section>
          <section className="admin-card space-y-4">
            <h2>Синхронизация категорий</h2>
            <p className="admin-hint">
              Сначала перенесите категории сайта в МойСклад. Затем создавайте и
              переименовывайте группы в МоёмСкладе — сайт получает изменения
              каждые 5 минут. Вложенные группы отображаются на сайте общим
              списком.
            </p>
            <p className="admin-hint">
              Фото, значки и порядок показа сохраняются. Архивные и удалённые
              группы скрываются с витрины; товары и история заказов остаются.
            </p>
            <AdminBadge
              tone={connection.categoriesEnabled ? "success" : "neutral"}
            >
              {connection.categoriesEnabled
                ? "Автообновление включено"
                : "Автообновление выключено"}
            </AdminBadge>
            {connection.categoriesSyncedAt && (
              <p className="admin-hint">
                Последнее обновление:{" "}
                {new Date(connection.categoriesSyncedAt).toLocaleString(
                  "ru-RU",
                )}
              </p>
            )}
            {connection.categoriesError && (
              <AdminNotice>{connection.categoriesError}</AdminNotice>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="admin-primary"
                disabled={!!busy || !connection.tokenSaved}
                onClick={() => {
                  if (
                    window.confirm(
                      "Перенести категории сайта в группы МоегоСклада и включить автообновление? Совпадающие по названию группы верхнего уровня будут связаны; остальные созданы.",
                    )
                  )
                    void change("categories-export", "POST", {
                      action: "categories-export",
                    });
                }}
              >
                {busy === "categories-export"
                  ? "Переносим категории…"
                  : "Перенести категории сайта в МойСклад"}
              </button>
              <button
                type="button"
                className="admin-secondary"
                disabled={!!busy || !connection.tokenSaved}
                onClick={() =>
                  void change("categories-sync", "POST", {
                    action: "categories-sync",
                  })
                }
              >
                {busy === "categories-sync"
                  ? "Обновляем…"
                  : "Обновить из МоегоСклада"}
              </button>
              {connection.categoriesEnabled && (
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={!!busy}
                  onClick={() =>
                    void change("categories-pause", "PUT", {
                      action: "categories-pause",
                    })
                  }
                >
                  Приостановить автообновление
                </button>
              )}
            </div>
          </section>
          <section className="admin-card space-y-4">
            <h2>Синхронизация товаров</h2>
            <p className="admin-hint">
              Из МоегоСклада загружаются название, описание, группа, фотография,
              единица продажи, выбранная цена в рублях и свободный остаток
              выбранного склада. Обновление — каждые 5 минут. Уже созданные
              вручную товары сайта сохраняются отдельно.
            </p>
            <p className="admin-hint">
              Поддерживаются обычные товары без модификаций в штуках,
              килограммах и литрах; граммы и миллилитры пересчитываются. Услуги,
              комплекты и модификации пока не импортируются. Отзывы, акции,
              поиск по синонимам и оформление карточки остаются в админке сайта.
            </p>
            <AdminBadge
              tone={connection.productsEnabled ? "success" : "neutral"}
            >
              {connection.productsEnabled
                ? "Автообновление товаров включено"
                : "Автообновление товаров выключено"}
            </AdminBadge>
            {connection.productsSyncedAt && (
              <p className="admin-hint">
                Последнее обновление товаров:{" "}
                {new Date(connection.productsSyncedAt).toLocaleString("ru-RU")}
              </p>
            )}
            {connection.productsError && (
              <AdminNotice>{connection.productsError}</AdminNotice>
            )}
            {connection.productsSummary.total !== undefined && (
              <p className="admin-hint">
                Загружено: {connection.productsSummary.total}. Недоступно для
                заказа: {connection.productsSummary.unavailable}. Не удалось
                обновить фото: {connection.productsSummary.imageErrors || 0}.
              </p>
            )}
            {!!connection.productsSummary.issues?.length && (
              <ul className="text-sm text-amber-800 space-y-1">
                {connection.productsSummary.issues.map((p, i) => (
                  <li key={i}>
                    {p.name}: {p.error}
                  </li>
                ))}
              </ul>
            )}
            <p className="admin-hint">
              Без цены, группы или остатка товар нельзя заказать. Если данные не
              обновлялись больше 15 минут, покупка импортированных товаров
              приостанавливается до успешного обновления. Передача заказов и
              резервирование в МоёмСкладе ещё не подключены.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="admin-primary"
                disabled={
                  !!busy ||
                  !connection.configured ||
                  !connection.categoriesEnabled
                }
                onClick={() =>
                  void change("products-sync", "POST", {
                    action: "products-sync",
                  })
                }
              >
                {busy === "products-sync"
                  ? "Загружаем товары…"
                  : "Загрузить товары из МоегоСклада"}
              </button>
              {connection.productsEnabled && (
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={!!busy}
                  onClick={() =>
                    void change("products-pause", "PUT", {
                      action: "products-pause",
                    })
                  }
                >
                  Приостановить обмен товарами
                </button>
              )}
            </div>
          </section>
          <form className="admin-card space-y-4" onSubmit={saveToken}>
            <h2>API-токен</h2>
            <p className="admin-hint">
              Используйте токен отдельного сотрудника для интеграции. Пароль от
              аккаунта здесь не нужен.
            </p>
            <label className="block max-w-2xl">
              {connection.tokenSaved
                ? "Новый токен — для замены подключения"
                : "Токен подключения"}
              <input
                className="admin-input mt-2"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                maxLength={4096}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={!!busy || !connection.canStoreCredentials}
                required
                placeholder={
                  connection.tokenSaved
                    ? "Сохранённый токен скрыт. Для замены вставьте новый"
                    : "Вставьте API-токен МоегоСклада"
                }
              />
            </label>
            <p className="admin-hint">
              Токен хранится зашифрованным и не показывается после сохранения.
              Перед заменой проверяется доступ к новому аккаунту. При замене
              потребуется заново выбрать организацию и склад.
            </p>
            {!connection.canStoreCredentials && (
              <AdminNotice>
                На сервере нужно настроить защиту ключей.
              </AdminNotice>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className="admin-primary"
                disabled={
                  !!busy || !token.trim() || !connection.canStoreCredentials
                }
              >
                {busy === "token"
                  ? "Проверяем доступ…"
                  : "Проверить и сохранить токен"}
              </button>
              <button
                type="button"
                className="admin-secondary"
                disabled={!!busy || !connection.tokenSaved}
                onClick={() =>
                  void change("check", "POST", { action: "check" })
                }
              >
                <AdminIcon name="refresh" />
                {busy === "check" ? "Проверяем…" : "Проверить подключение"}
              </button>
            </div>
            {connection.checkedAt && (
              <p className="admin-hint">
                Последняя успешная проверка:{" "}
                {new Date(connection.checkedAt).toLocaleString("ru-RU")}
              </p>
            )}
            {connection.lastError && (
              <AdminNotice>{connection.lastError}</AdminNotice>
            )}
          </form>
          {connection.tokenSaved && (
            <form className="admin-card space-y-4" onSubmit={saveSelection}>
              <h2>Параметры обмена</h2>
              <div className="admin-form-grid">
                {select(
                  "Организация",
                  "organizationId",
                  connection.references.organizations,
                )}
                {select("Склад", "storeId", connection.references.stores)}
                {select(
                  "Тип цен для сайта",
                  "priceTypeId",
                  connection.references.priceTypes,
                )}
              </div>
              <p className="admin-hint">
                Справочники загружаются из вашего аккаунта. Если нужного склада
                или типа цен нет, добавьте его в МоёмСкладе и повторите проверку
                подключения.
              </p>
              <button
                className="admin-primary"
                disabled={
                  !!busy ||
                  !!connection.lastError ||
                  !selection.organizationId ||
                  !selection.storeId ||
                  !selection.priceTypeId
                }
              >
                {busy === "selection" ? "Сохраняем…" : "Сохранить параметры"}
              </button>
            </form>
          )}
          <section className="admin-card space-y-4">
            <div className="flex flex-wrap justify-between gap-3">
              <h2>Каталог МоегоСклада</h2>
              <AdminBadge>
                {connection.tokenSaved
                  ? `${connection.catalogCount} позиций`
                  : "Ожидает подключения"}
              </AdminBadge>
            </div>
            {connection.tokenSaved && connection.catalogCount > 0 ? (
              <>
                <p className="admin-hint">
                  Первые позиции для проверки аккаунта:
                </p>
                <ul className="space-y-2">
                  {connection.preview.map((row) => (
                    <li key={row.id} className="rounded-xl bg-gray-50 p-3">
                      {row.name}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="admin-hint">
                {connection.tokenSaved
                  ? "Аккаунт пока пустой. Создайте товары и укажите цены, затем заведите начальные остатки через документ оприходования."
                  : "После подключения здесь появится обзор ассортимента вашего аккаунта."}
              </p>
            )}
            <AdminNotice tone="info">
              Обмен товарами и категориями настраивается выше. Передача заказов
              и резервирование в МоёмСкладе пока не подключены.
            </AdminNotice>
          </section>
          {connection.tokenSaved && (
            <section className="admin-card space-y-3">
              <h2>Удалить подключение</h2>
              <p className="admin-hint">
                Удаляется только токен из магазина. Товары, заказы и данные
                аккаунта МоегоСклада сохраняются. Сам API-токен можно отозвать в
                МоёмСкладе.
              </p>
              <button
                className="admin-secondary"
                disabled={!!busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Удалить токен МоегоСклада из магазина? Каталог и заказы сохранятся.",
                    )
                  )
                    void change("disconnect", "DELETE");
                }}
              >
                {busy === "disconnect"
                  ? "Удаляем…"
                  : "Удалить токен из магазина"}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
