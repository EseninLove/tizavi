import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ProductsProvider } from './context/ProductsContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { TelegramProvider } from './lib/telegram';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TelegramProvider>
        <AppProvider>
          <ProductsProvider>
            <SubscriptionProvider>
              <App />
            </SubscriptionProvider>
          </ProductsProvider>
        </AppProvider>
      </TelegramProvider>
    </BrowserRouter>
  </React.StrictMode>
);
