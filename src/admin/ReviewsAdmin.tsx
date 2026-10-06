import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import {
  AdminHeader,
  AdminSearch,
  AdminTabs,
  AdminNotice,
  AdminEmpty,
  AdminBadge,
  adminDate,
} from "./AdminUI";
interface Review {
  id: number;
  product_name: string;
  rating: number;
  message: string;
  visible: boolean;
  created_at?: string;
  telegram_id?: number;
}
export function ReviewsAdmin() {
  const [reviews, setReviews] = useState<Review[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<number | null>(null),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiFetch("/api/reviews?admin=true");
      if (!d.ok) throw new Error(d.error);
      setReviews(d.reviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const toggle = async (r: Review) => {
    if (busy !== null) return;
    setBusy(r.id);
    setError("");
    try {
      const d = await apiFetch("/api/reviews", {
        method: "PUT",
        body: JSON.stringify({ id: r.id, visible: !r.visible }),
      });
      if (!d.ok) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(null);
    }
  };
  const filtered = reviews.filter(
    (r) =>
      (filter === "all" || (filter === "published" ? r.visible : !r.visible)) &&
      [r.product_name, r.message, String(r.telegram_id || "")]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <div>
      <AdminHeader
        title="Отзывы"
        subtitle="Оценки покупателей учитываются вместе с оценками магазина в карточке товара"
      />
      <div className="admin-toolbar">
        <AdminSearch
          value={search}
          onChange={setSearch}
          placeholder="Товар, текст отзыва или ID покупателя"
        />
        <button
          className="admin-button"
          disabled={loading}
          onClick={() => void load()}
        >
          Обновить
        </button>
      </div>
      <AdminTabs
        tabs={[
          { id: "all", label: "Все", count: reviews.length },
          {
            id: "published",
            label: "Опубликованы",
            count: reviews.filter((r) => r.visible).length,
          },
          {
            id: "hidden",
            label: "Скрыты",
            count: reviews.filter((r) => !r.visible).length,
          },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error && <AdminNotice>{error}</AdminNotice>}
      {loading ? (
        <AdminEmpty title="Загрузка отзывов…" />
      ) : !filtered.length ? (
        <AdminEmpty title="Отзывов не найдено" />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <section key={r.id} className="admin-card">
              <div className="flex justify-between gap-3">
                <h2>
                  {r.product_name} · {r.rating}/5
                </h2>
                <AdminBadge tone={r.visible ? "success" : "neutral"}>
                  {r.visible ? "Опубликован" : "Скрыт"}
                </AdminBadge>
              </div>
              <p className="admin-hint">
                {r.telegram_id
                  ? `Покупатель ${r.telegram_id}`
                  : "Отзыв покупателя"}
                {r.created_at ? ` · ${adminDate(r.created_at)}` : ""}
              </p>
              <p className="my-3 whitespace-pre-wrap">
                {r.message || "Без текста"}
              </p>
              <button
                disabled={busy !== null}
                className="admin-button"
                onClick={() => void toggle(r)}
              >
                {busy === r.id
                  ? "Сохраняем…"
                  : r.visible
                    ? "Скрыть отзыв"
                    : "Опубликовать отзыв"}
              </button>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
