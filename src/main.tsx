import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ProductsProvider } from './context/ProductsContext';
import { TelegramProvider } from './lib/telegram';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TelegramProvider>
        <AppProvider>
          <ProductsProvider>
            <App />
          </ProductsProvider>
        </AppProvider>
      </TelegramProvider>
    </BrowserRouter>
  </React.StrictMode>
);
