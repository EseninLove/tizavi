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
    try {
      return JSON.parse(localStorage.getItem("tizavi_delivery") || "null");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    localStorage.setItem("tizavi_delivery", JSON.stringify(quote));
  }, [quote]);
  return (
    <Context.Provider value={{ quote, setQuote }}>{children}</Context.Provider>
  );
}
export function useDelivery() {
  const value = useContext(Context);
  if (!value) throw new Error("DeliveryProvider missing");
  return value;
}
