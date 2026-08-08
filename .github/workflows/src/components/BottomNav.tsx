import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTelegram } from '../lib/telegram';
import { HomeIcon, CartIcon, HeartIcon, UserIcon } from './Icons';

const navItems = [
  { path: '/', label: 'Каталог', Icon: HomeIcon },
  { path: '/cart', label: 'Корзина', Icon: CartIcon },
  { path: '/wishlist', label: 'Избранное', Icon: HeartIcon },
  { path: '/profile', label: 'Профиль', Icon: UserIcon },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, wishlist } = useApp();
  const { haptic } = useTelegram();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div
        className="flex items-center justify-around bg-tg-section-bg/95 backdrop-blur-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-tg-separator" />
        {navItems.map(({ path, label, Icon }) => {
          const active = isActive(path);
          const badge = path === '/cart' ? cartCount : path === '/wishlist' ? wishlist.length : 0;
          return (
            <button
              key={path}
              onClick={() => {
                haptic.select();
                navigate(path);
              }}
              className={`relative flex flex-col items-center gap-1 py-3 px-3 flex-1 transition-colors ${
                active ? 'text-tg-button' : 'text-tg-hint'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {badge > 0 && (
                  <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-tg-button text-tg-buttonText">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
