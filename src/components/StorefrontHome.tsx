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
const collections = [
  {
    id: "sale",
    number: "01",
    title: "Приятные цены",
    text: "Товары со скидкой",
    label: "Смотреть акции",
    className: "sale",
  },
  {
    id: "popular",
    number: "02",
    title: "Любимые продукты",
    text: "Популярное в магазине",
    label: "Выбрать продукты",
    className: "popular",
  },
  {
    id: "seasonal",
    number: "03",
    title: "Вкус этого сезона",
    text: "Сезонная подборка",
    label: "За покупками",
    className: "seasonal",
  },
];

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
      <section className="market-collections" aria-label="Подборки продуктов">
        {collections.map((c) => (
          <button
            key={c.id}
            className={`market-collection market-collection-${c.className}`}
            onClick={() => onBrowse("all", c.id)}
          >
            <span className="market-collection-top">
              {c.text}
              <span>{c.number}</span>
            </span>
            <strong>{c.title}</strong>
            <span className="market-collection-link">
              {c.label}
              <span aria-hidden="true">↗</span>
            </span>
          </button>
        ))}
      </section>
      {categories.some((c) => c.id !== "all") && (
        <section
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
      <section
        className="market-delivery-info"
        aria-labelledby="market-delivery-title"
      >
        <div>
          <span className="market-eyebrow">Просто и удобно</span>
          <h2 id="market-delivery-title">
            Покупки — онлайн.
            <br />
            <em>Больше времени — себе.</em>
          </h2>
          <p>
            Выбирайте продукты дома, на работе или по дороге. Магазин доступен в
            браузере и в Telegram.
          </p>
          <Link className="market-text-link" to="/support">
            Есть вопрос? Мы поможем <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <ol className="market-steps">
          <li>
            <span>01</span>
            <div>
              <h3>Выберите продукты</h3>
              <p>Найдите нужное в категориях и добавьте в корзину.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Укажите адрес</h3>
              <p>
                Стоимость и доступное время доставки появятся после расчёта
                адреса.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Оформите заказ</h3>
              <p>
                Для заказа нужна подписка. Статус покупки можно посмотреть в
                профиле.
              </p>
            </div>
          </li>
        </ol>
      </section>
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
          Tizavi<span>Продукты с доставкой</span>
        </Link>
        <div>
          <Link to="/support">Помощь</Link>
          <Link to="/legal/offer">Оферта</Link>
          <Link to="/legal/privacy">Конфиденциальность</Link>
        </div>
        <span>Москва и Московская область</span>
      </footer>
    </div>
  );
}
