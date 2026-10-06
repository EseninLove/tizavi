import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  CartItem,
  Order,
  OrderDelivery,
  PaymentMethod,
  Product,
} from "../types";
import { useTelegram } from "../lib/telegram";
import { shopRequest } from "../lib/api";
import { quantityStep } from "../utils/format";
const CART_KEY = "tizavi_cart",
  WISHLIST_KEY = "tizavi_wishlist";
interface AppContextValue {
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  ordersLoading: boolean;
  ordersError: string;
  cartCount: number;
  cartTotal: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, q: number) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
  placeOrder: (
    delivery: OrderDelivery,
    method: PaymentMethod,
  ) => Promise<Order>;
  refreshOrders: () => Promise<Order[]>;
  settleOrder: (order: Order) => void;
}
const Context = createContext<AppContextValue | null>(null);
function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}
export function AppProvider({ children }: { children: ReactNode }) {
  const { webApp, haptic } = useTelegram();
  const [cart, setCart] = useState<CartItem[]>(() => load(CART_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() =>
    load(WISHLIST_KEY, []),
  );
  const [orders, setOrders] = useState<Order[]>([]),
    [ordersLoading, setOrdersLoading] = useState(false),
    [ordersError, setOrdersError] = useState("");
  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart]);
  useEffect(
    () => localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist)),
    [wishlist],
  );
  const refreshOrders = useCallback(async () => {
    if (!webApp?.initData) return [];
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const data = await shopRequest<{ ok: boolean; orders: Order[] }>(
        "/api/my-orders",
        { initData: webApp.initData },
      );
      setOrders(data.orders);
      return data.orders;
    } catch (error) {
      setOrdersError(
        error instanceof Error ? error.message : "Не удалось загрузить заказы",
      );
      throw error;
    } finally {
      setOrdersLoading(false);
    }
  }, [webApp]);
  useEffect(() => {
    void refreshOrders().catch(() => {});
  }, [refreshOrders]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        void refreshOrders().catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [refreshOrders]);
  const addToCart = (
    product: Product,
    quantity = quantityStep(product.unit),
  ) => {
    if (!product.inStock) return;
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      return found
        ? prev.map((i) =>
            i.product.id === product.id
              ? {
                  product,
                  quantity: Math.round((i.quantity + quantity) * 100) / 100,
                }
              : i,
          )
        : [...prev, { product, quantity }];
    });
    haptic.impact("light");
  };
  const removeFromCart = (id: string) =>
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  const updateQuantity = (id: string, q: number) => {
    if (q <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, quantity: Math.round(q * 100) / 100 } : i,
      ),
    );
  };
  const toggleWishlist = (id: string) =>
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  const settleOrder = useCallback(
    (order: Order) => {
      if (order.paymentStatus !== "succeeded") return;
      const key = `tizavi_settled_${webApp?.initDataUnsafe.user?.id || "guest"}`;
      const settled = load<string[]>(key, []);
      if (settled.includes(order.id)) return;
      setCart((prev) =>
        prev
          .map((item) => {
            const paid = order.items.find(
              (i) => i.product.id === item.product.id,
            );
            return {
              ...item,
              quantity: Math.max(
                0,
                Math.round((item.quantity - (paid?.quantity || 0)) * 100) / 100,
              ),
            };
          })
          .filter((i) => i.quantity > 0),
      );
      localStorage.setItem(
        key,
        JSON.stringify([...settled, order.id].slice(-200)),
      );
      setOrders((prev) => [order, ...prev.filter((i) => i.id !== order.id)]);
    },
    [webApp],
  );
  const placeOrder = async (
    delivery: OrderDelivery,
    _method: PaymentMethod,
  ) => {
    if (!webApp?.initData) throw new Error("Откройте магазин в Telegram");
    const items = cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
    }));
    const fingerprint = JSON.stringify({ items, delivery });
    const previous = load<{ fingerprint: string; key: string }>(
      "tizavi_checkout_request",
      { fingerprint: "", key: "" },
    );
    const requestKey =
      previous.fingerprint === fingerprint ? previous.key : crypto.randomUUID();
    localStorage.setItem(
      "tizavi_checkout_request",
      JSON.stringify({ fingerprint, key: requestKey }),
    );
    const data = await shopRequest<{ ok: boolean; order: Order }>(
      "/api/orders",
      { initData: webApp.initData, items, delivery, requestKey },
    );
    setOrders((prev) => [
      data.order,
      ...prev.filter((o) => o.id !== data.order.id),
    ]);
    return data.order;
  };
  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, i) => sum + Math.round(i.product.price * i.quantity * 100),
        0,
      ) / 100,
    [cart],
  );
  return (
    <Context.Provider
      value={{
        cart,
        wishlist,
        orders,
        ordersLoading,
        ordersError,
        cartCount: cart.length,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart: () => setCart([]),
        isInCart: (id) => cart.some((i) => i.product.id === id),
        toggleWishlist,
        isWishlisted: (id) => wishlist.includes(id),
        placeOrder,
        refreshOrders,
        settleOrder,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("AppProvider missing");
  return ctx;
}
