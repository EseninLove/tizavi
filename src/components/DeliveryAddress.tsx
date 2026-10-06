import { useEffect, useState } from "react";
import { useDelivery } from "../context/DeliveryContext";
import { shopRequest } from "../lib/api";
import type { DeliveryQuote } from "../types";
export function deliveryWindow(quote: {
  earliestAt: string;
  latestAt: string;
}) {
  const date = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "numeric",
      month: "short",
    }),
    time = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${date.format(new Date(quote.earliestAt))}, ${time.format(new Date(quote.earliestAt))}–${time.format(new Date(quote.latestAt))}`;
}
export function DeliveryAddress() {
  const { quote, setQuote } = useDelivery();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [suggestions, setSuggestions] = useState<
      Array<{ id: string; value: string }>
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let stopped = false;
    const timer = setTimeout(() => {
      setBusy(true);
      void shopRequest<{ suggestions: Array<{ id: string; value: string }> }>(
        "/api/delivery",
        { action: "suggest", query },
      )
        .then((data) => {
          if (!stopped) {
            setSuggestions(data.suggestions);
            setError(
              data.suggestions.length
                ? ""
                : "Адрес не найден. Укажите улицу и номер дома.",
            );
          }
        })
        .catch((e) => {
          if (!stopped) setError(e.message);
        })
        .finally(() => {
          if (!stopped) setBusy(false);
        });
    }, 350);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [query, open]);
  const select = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const data = await shopRequest<{ quote: DeliveryQuote }>(
        "/api/delivery",
        { addressId: id },
      );
      setQuote(data.quote);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось рассчитать доставку",
      );
    } finally {
      setBusy(false);
    }
  };
  const valid = quote && new Date(quote.latestAt).getTime() > Date.now();
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setQuery(quote?.address || "");
          setError("");
        }}
        className="w-full text-left rounded-xl px-3 py-2 bg-tg-section-bg"
      >
        <span className="block text-sm font-semibold truncate">
          📍 {quote?.address || "Укажите адрес доставки"} ›
        </span>
        <span className="block text-xs text-tg-hint mt-0.5">
          {valid
            ? `Ориентировочно ${deliveryWindow(quote)}`
            : "Москва и Московская область"}
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Адрес доставки"
            className="w-full max-w-md section-card rounded-t-3xl p-4 space-y-3 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="font-bold">Куда доставить?</h2>
              <button
                aria-label="Закрыть адрес"
                onClick={() => setOpen(false)}
                className="w-10 h-10"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-tg-hint">
              Доставка по Москве и Московской области. Введите улицу и дом.
            </p>
            <input
              aria-label="Улица и дом"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError("");
              }}
              className="input"
              placeholder="Москва, улица, дом"
              autoFocus
            />
            {busy && <p className="text-xs text-tg-hint">Проверяем адрес…</p>}
            {suggestions.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => void select(s.id)}
                className="w-full p-3 text-sm text-left rounded-xl bg-tg-secondary-bg"
              >
                {s.value}
              </button>
            ))}
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <p className="text-xs text-tg-hint">
              Время предварительное: рассчитывается от ближайшего доступного
              склада без учёта пробок.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
