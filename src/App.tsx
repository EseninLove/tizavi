import { Search } from "./pages/Search";
import { ProfileSettings } from "./pages/ProfileSettings";
import { ShopHeader } from "./components/ShopHeader";
import { Auth } from "./pages/Auth";
import { PaymentMonitor } from "./components/PaymentMonitor";
import { PaymentReturn } from "./pages/PaymentReturn";
import { lazy, Suspense, useLayoutEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Catalog } from "./pages/Catalog";
import { ProductDetail } from "./pages/ProductDetail";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { OrderSuccess } from "./pages/OrderSuccess";
import { Wishlist } from "./pages/Wishlist";
import { Profile } from "./pages/Profile";
import { Subscribe } from "./pages/Subscribe";
import { Legal } from "./pages/Legal";
import { Support } from "./pages/Support";
import { BottomNav } from "./components/BottomNav";
import { useBackButton } from "./hooks/useBackButton";

const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((m) => ({ default: m.AdminApp })),
);

export default function App() {
  const location = useLocation();
  useBackButton();

  const isAdmin = location.pathname.startsWith("/admin");
  useLayoutEffect(() => {
    if (!isAdmin) window.scrollTo(0, 0);
  }, [location.pathname, isAdmin]);
  const hideBottomNav =
    isAdmin ||
    ["/auth", "/checkout", "/order-success", "/payment-return"].some((p) =>
      location.pathname.startsWith(p),
    );

  return (
    <div className={isAdmin ? undefined : "shop-shell"}>
      {!isAdmin && <ShopHeader />}
      <PaymentMonitor />
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Catalog />} />
        <Route path="/search" element={<Search />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:id" element={<OrderSuccess />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/profile/settings" element={<ProfileSettings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment-return" element={<PaymentReturn />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/legal/:doc" element={<Legal />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<Catalog />} />
      </Routes>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
