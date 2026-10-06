import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { ProductsProvider } from "./context/ProductsContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TelegramProvider } from "./lib/telegram";
import "./index.css";
import { DeliveryProvider } from "./context/DeliveryContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TelegramProvider>
        <ThemeProvider>
          <AppProvider>
            <ProductsProvider>
              <SubscriptionProvider>
                <DeliveryProvider>
                  <App />
                </DeliveryProvider>
              </SubscriptionProvider>
            </ProductsProvider>
          </AppProvider>
        </ThemeProvider>
      </TelegramProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
