import { useEffect, useState } from "react";
import { apiFetch } from "./api";
interface Review {
  id: number;
  product_name: string;
  rating: number;
  message: string;
  visible: boolean;
}
export function ReviewsAdmin() {
  const [reviews, setReviews] = useState<Review[]>([]),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const d = await apiFetch("/api/reviews?admin=true");
      if (!d.ok) throw new Error(d.error);
      setReviews(d.reviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить отзывы");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const toggle = async (r: Review) => {
    try {
      const d = await apiFetch("/api/reviews", {
        method: "PUT",
        body: JSON.stringify({ id: r.id, visible: !r.visible }),
      });
      if (!d.ok) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };
  return (
    <div className="space-y-4 text-gray-900">
      <h1 className="text-2xl font-bold">Отзывы покупателей</h1>
      <p className="text-sm text-gray-600">
        Опубликованные оценки покупателей учитываются вместе с оценками
        магазина, заданными в карточке товара.
      </p>
      {error && <p className="text-red-600">{error}</p>}
      {reviews.length ? (
        reviews.map((r) => (
          <section key={r.id} className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold">
              {r.product_name} · {r.rating}/5
            </h2>
            <p className="text-sm my-2">{r.message || "Без текста"}</p>
            <button
              onClick={() => void toggle(r)}
              className="text-sm text-green-700"
            >
              {r.visible ? "Скрыть отзыв" : "Опубликовать отзыв"}
            </button>
          </section>
        ))
      ) : (
        <p className="text-sm text-gray-500">Отзывов пока нет</p>
      )}
    </div>
  );
}
