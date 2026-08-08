import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTelegram } from '../lib/telegram';

const routesWithBackButton = ['/product/', '/cart', '/checkout', '/order-success'];

export function useBackButton() {
  const { webApp } = useTelegram();
  const location = useLocation();
  const navigate = useNavigate();

  const shouldShow = routesWithBackButton.some(
    (route) =>
      location.pathname.startsWith(route.replace(/\/$/, '')) &&
      location.pathname !== '/cart'
  );

  useEffect(() => {
    if (!webApp) return;

    const handleBack = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    };

    if (shouldShow) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBack);
    } else {
      webApp.BackButton.hide();
    }

    return () => {
      webApp.BackButton.offClick(handleBack);
    };
  }, [webApp, shouldShow, navigate]);
}
