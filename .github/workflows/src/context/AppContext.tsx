import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartItem, Order, OrderDelivery, PaymentMethod, Product } from '../types';
import { generateOrderId } from '../utils/format';
import { useTelegram } from '../lib/telegram';

const CART_KEY = 'tizavi_cart';
const WISHLIST_KEY = 'tizavi_wishlist';
const ORDERS_KEY = 'tizavi_orders';

interface AppContextValue {
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  cartCount: number;
  cartTotal: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  placeOrder: (delivery: OrderDelivery, paymentMethod: PaymentMethod) => Order;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { haptic } = useTelegram();
  const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage(CART_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() => loadFromStorage(WISHLIST_KEY, []));
  const [orders, setOrders] = useState<Order[]>(() => loadFromStorage(ORDERS_KEY, []));

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }, [orders]);

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
    haptic.impact('light');
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    haptic.impact('light');
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setCart([]);

  const isInCart = (productId: string) => cart.some((i) => i.product.id === productId);

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      if (prev.includes(productId)) {
        haptic.impact('light');
        return prev.filter((id) => id !== productId);
      }
      haptic.notify('success');
      return [...prev, productId];
    });
  };

  const isWishlisted = (productId: string) => wishlist.includes(productId);

  const cartCount = useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [cart]
  );

  const placeOrder = (delivery: OrderDelivery, paymentMethod: PaymentMethod): Order => {
    const order: Order = {
      id: generateOrderId(),
      items: [...cart],
      total: cartTotal,
      delivery,
      paymentMethod,
      createdAt: Date.now(),
      status: 'paid',
    };
    setOrders((prev) => [order, ...prev]);
    clearCart();
    haptic.notify('success');
    return order;
  };

  const value: AppContextValue = {
    cart,
    wishlist,
    orders,
    cartCount,
    cartTotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isInCart,
    toggleWishlist,
    isWishlisted,
    placeOrder,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
