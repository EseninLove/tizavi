import { clearPrivate } from "../lib/private-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useTelegram } from "../lib/telegram";
export interface Customer {
  id: number;
  telegramId: number | null;
  email: string | null;
  emailVerified: boolean;
  name: string;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
}
interface AuthValue {
  user: Customer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  submit: (action: string, fields: Record<string, string>) => Promise<Customer>;
  logout: () => Promise<void>;
  miniApp: boolean;
}
const Context = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { webApp } = useTelegram(),
    initData = webApp?.initData || "";
  const generation = useRef(0);
  const [user, setUser] = useState<Customer | null>(null),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(
    async (silent = false) => {
      const turn = ++generation.current;
      if (!silent) setLoading(true);
      try {
        const r = await fetch(
            "/api/customer-auth",
            initData
              ? {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "me", initData }),
                }
              : undefined,
          ),
          d = await r.json();
        if (!r.ok || !d.ok) throw new Error();
        if (turn === generation.current) setUser(d.user);
      } catch {
        if (turn === generation.current) setUser(null);
      } finally {
        if (turn === generation.current) setLoading(false);
      }
    },
    [initData],
  );
  useEffect(() => {
    void refresh();
    const focus = () => void refresh(true);
    window.addEventListener("focus", focus);
    window.addEventListener("tizavi-customer-expired", focus);
    return () => {
      ++generation.current;
      window.removeEventListener("focus", focus);
      window.removeEventListener("tizavi-customer-expired", focus);
    };
  }, [refresh]);
  const submit = async (action: string, fields: Record<string, string>) => {
    ++generation.current;
    const r = await fetch("/api/customer-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...fields,
          ...(initData ? { initData } : {}),
        }),
      }),
      d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || "Не удалось войти");
    setUser(d.user);
    setLoading(false);
    return d.user as Customer;
  };
  const logout = async () => {
    ++generation.current;
    const r = await fetch("/api/customer-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    if (!r.ok) throw new Error("Не удалось выйти");
    setUser(null);
    clearPrivate();
    for (const key of [
      "tizavi_pending_payment",
      "tizavi_subscription_request",
      "tizavi_checkout_request",
    ])
      localStorage.removeItem(key);
  };
  return (
    <Context.Provider
      value={{ user, loading, refresh, submit, logout, miniApp: !!initData }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
