import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { OrderSuccess } from './pages/OrderSuccess';
import { Wishlist } from './pages/Wishlist';
import { Profile } from './pages/Profile';
import { Subscribe } from './pages/Subscribe';
import { Legal } from './pages/Legal';
import { Support } from './pages/Support';
import { BottomNav } from './components/BottomNav';
import { useBackButton } from './hooks/useBackButton';

const AdminApp = lazy(() =>
  import('./admin/AdminApp').then((m) => ({ default: m.AdminApp }))
);

export default function App() {
  const location = useLocation();
  useBackButton();

  const isAdmin = location.pathname.startsWith('/admin');
  const hideBottomNav =
    isAdmin ||
    ['/checkout', '/order-success'].some((p) => location.pathname.startsWith(p));

  return (
    <>
      <Routes>
        <Route path="/admin/*" element={
          <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
            <AdminApp />
          </Suspense>
        } />
        <Route path="/" element={<Catalog />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:id" element={<OrderSuccess />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/legal/:doc" element={<Legal />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<Catalog />} />
      </Routes>
      {!hideBottomNav && <BottomNav />}
    </>
  );
}
