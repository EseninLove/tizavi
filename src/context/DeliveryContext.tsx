import { readPrivate, writePrivate } from "../lib/private-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { DeliveryQuote } from "../types";
interface Value {
  quote: DeliveryQuote | null;
  setQuote: (quote: DeliveryQuote | null) => void;
}
const Context = createContext<Value | null>(null);
export function DeliveryProvider({ children }: { children: ReactNode }) {
  const [quote, setQuote] = useState<DeliveryQuote | null>(() => {
    localStorage.removeItem("tizavi_checkout_request");
    return readPrivate<DeliveryQuote>("tizavi_delivery");
  });
  useEffect(() => {
    let previousExpiry = Infinity;
    try {
      const stored = JSON.parse(
        sessionStorage.getItem("tizavi_delivery") || "null",
      );
      if (
        quote &&
        stored?.value?.addressId === quote.addressId &&
        stored?.value?.latestAt === quote.latestAt
      )
        previousExpiry = stored.expiresAt;
    } catch {
      /* Ignore an invalid local draft. */
    }
    const expiry = quote
      ? Math.min(
          Date.now() + 86400000,
          new Date(quote.latestAt).getTime(),
          previousExpiry,
        )
      : Date.now();
    writePrivate("tizavi_delivery", quote, expiry);
    if (!quote) return;
    const timer = window.setTimeout(
      () => setQuote(null),
      Math.max(0, expiry - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [quote]);
  useEffect(() => {
    const clear = () => setQuote(null);
    window.addEventListener("tizavi-private-data-cleared", clear);
    return () =>
      window.removeEventListener("tizavi-private-data-cleared", clear);
  }, []);
  return (
    <Context.Provider value={{ quote, setQuote }}>{children}</Context.Provider>
  );
}
export function useDelivery() {
  const value = useContext(Context);
  if (!value) throw new Error("DeliveryProvider missing");
  return value;
}
