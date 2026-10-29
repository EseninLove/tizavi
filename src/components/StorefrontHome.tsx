import { BrandLogo } from "./BrandLogo";
import { Link } from "react-router-dom";
import type { Category, Product } from "../types";
import { CartIcon, HeartIcon, HomeIcon } from "./Icons";

const categoryIcons: Record<string, string> = {
  "fruits-vegetables": "🥬",
  dairy: "🥛",
  meat: "🥩",
  fish: "🐟",
  bakery: "🥖",
  grocery: "🌾",
  drinks: "☕",
  frozen: "❄️",
  sweets: "🍪",
};

export function StorefrontHome({
  categories,
  products,
  onBrowse,
}: {
  categories: Category[];
  products: Product[];
  onBrowse: (category?: string, section?: string) => void;
}) {
  return (
    <div className="market-home">
      <section className="market-hero" aria-labelledby="market-title">
        <div className="market-hero-copy">
          <span className="market-eyebrow">
            <span /> Ваш магазин рядом
          </span>
          <h1 id="market-title">
            Всё к вашему
            <br />
            столу. <em>С доставкой.</em>
          </h1>
          <p>
            От продуктов на каждый день до любимых вкусов. Соберите корзину —
            остальное оставьте нам.
          </p>
          <button className="market-cta" onClick={() => onBrowse()}>
            Выбрать продукты <span aria-hidden="true">↗</span>
          </button>
          <div className="market-hero-note">
            <HomeIcon className="w-4 h-4" />
            <span>Москва и Московская область</span>
          </div>
        </div>
        <div className="market-hero-visual">
          <div className="market-hero-orbit" />
          <img
            src="/images/grocery-bag.webp"
            alt="Бумажный пакет с овощами, молоком и багетом"
            width="900"
            height="900"
            fetchPriority="high"
          />
          <span className="market-hero-stamp">
            Хороший день
            <br />
            <strong>
              начинается
              <br />
              со вкуса
            </strong>
          </span>
        </div>
      </section>
      {categories.some((c) => c.id !== "all") && (
        <section
          id="market-categories"
          className="market-categories"
          aria-labelledby="market-categories-title"
        >
          <div className="market-section-title">
            <div>
              <span className="market-eyebrow">Найдите своё</span>
              <h2 id="market-categories-title">Что положим в корзину?</h2>
            </div>
            <button onClick={() => onBrowse()}>
              Все товары <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="market-category-grid">
            {categories
              .filter((c) => c.id !== "all")
              .map((c) => {
                const image =
                  c.image ||
                  products.find((p) => p.category === c.id && p.image)?.image;
                return (
                  <button
                    key={c.id}
                    className="market-category"
                    onClick={() => onBrowse(c.id)}
                  >
                    <span className="market-category-art">
                      {image ? (
                        <img src={image} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">
                          {c.emoji || categoryIcons[c.id] || "🛒"}
                        </span>
                      )}
                    </span>
                    <strong>{c.name}</strong>
                    <span className="market-category-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}

export function StorefrontFooter() {
  return (
    <div className="market-bottom">
      <section className="market-benefits" aria-label="Возможности магазина">
        <div>
          <CartIcon className="w-6 h-6" />
          <h3>Своя корзина</h3>
          <p>Количество, вес и стоимость продуктов — всегда перед глазами.</p>
        </div>
        <div>
          <HeartIcon className="w-6 h-6" />
          <h3>Любимое под рукой</h3>
          <p>Сохраняйте продукты в избранное, чтобы легко найти их снова.</p>
        </div>
        <div>
          <HomeIcon className="w-6 h-6" />
          <h3>Повторить — легко</h3>
          <p>История покупок и повтор заказа доступны в вашем профиле.</p>
        </div>
      </section>
      <footer className="market-footer">
        <Link to="/" className="market-footer-brand">
          <BrandLogo />
          <span className="market-footer-tagline">Продукты с доставкой</span>
        </Link>
        <div>
          <Link to="/support">Помощь</Link>
          <Link to="/legal/offer">Оферта</Link>
          <Link to="/legal/privacy">Конфиденциальность</Link>
          <Link to="/profile/privacy">Персональные данные</Link>
        </div>
        <span>Москва и Московская область</span>
      </footer>
    </div>
  );
}
