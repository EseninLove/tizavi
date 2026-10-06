import { useEffect, useState } from "react";
import { useTelegram } from "../lib/telegram";
import { useApp } from "../context/AppContext";
import { useProducts } from "../context/ProductsContext";
import { shopRequest } from "../lib/api";
interface Review {
  id: number;
  rating: number;
  message: string;
  created_at: string;
}
export function ProductReviews({ productId }: { productId: string }) {
  const { webApp } = useTelegram(),
    { orders } = useApp(),
    { reload } = useProducts();
  const [reviews, setReviews] = useState<Review[]>([]),
    [rating, setRating] = useState(5),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  const purchased = orders.some(
    (o) =>
      o.paymentStatus === "succeeded" &&
      o.status !== "cancelled" &&
      o.items.some((i) => i.product.id === productId),
  );
  useEffect(() => {
    let cancelled = false;
    setError("");
    setSent(false);
    fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data.ok) setReviews(data.reviews);
          else setError(data.error || "Отзывы недоступны");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить отзывы");
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await shopRequest("/api/reviews", {
        initData: webApp?.initData,
        productId,
        rating,
        message,
      });
      setSent(true);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить отзыв");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="section-card p-4 mt-4 space-y-3">
      <h2 className="font-semibold text-sm">Отзывы покупателей</h2>
      {reviews.length ? (
        reviews.map((r) => (
          <div key={r.id} className="border-t border-tg-separator pt-3">
            <p className="text-sm">
              {"★".repeat(r.rating)}{" "}
              <span className="text-xs text-tg-hint">Покупка подтверждена</span>
            </p>
            <p className="text-sm mt-1">
              {r.message || "Покупатель оставил оценку без текста"}
            </p>
          </div>
        ))
      ) : (
        <p className="text-xs text-tg-hint">Пока нет отзывов покупателей.</p>
      )}
      {purchased && !sent && (
        <div className="space-y-2 border-t border-tg-separator pt-3">
          <label className="block text-xs">
            Ваша оценка
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="input mt-1"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} из 5
                </option>
              ))}
            </select>
          </label>
          <textarea
            aria-label="Ваш отзыв"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Расскажите о товаре"
            className="input"
            maxLength={2000}
          />
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void submit()}
          >
            Оставить отзыв
          </button>
        </div>
      )}
      {sent && (
        <p role="status" className="text-sm">
          Спасибо! Отзыв сохранён. Изменённые отзывы проходят проверку.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </section>
  );
}
