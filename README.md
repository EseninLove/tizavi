# Tizavi Shop — Telegram Mini App

Telegram Mini App интернет-магазина на **React + Vite + TypeScript + Tailwind CSS** с интеграцией Telegram Web App SDK.

## Возможности

- Каталог товаров с категориями и поиском
- Карточка товара с фото, описанием, рейтингом, выбором количества
- Корзина с управлением количеством товаров
- Оформление заказа (курьер / самовывоз, контакты)
- Оплата: Telegram Stars (⭐) и банковская карта (через платёжного провайдера)
- Избранное / wishlist
- Профиль пользователя с данными из Telegram и историей заказов
- Тёмная/светлая темы (автоматически из Telegram)
- Тактильная отдача (Haptic Feedback), MainButton, BackButton
- Сохранение корзины, избранного и заказов в localStorage

## Запуск

```bash
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:3000`.

## Сборка

```bash
npm run build
```

Готовая сборка — в папке `dist/`. Используйте `base: './'` (уже настроено), чтобы работало по любому пути.

## Подключение к Telegram

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Отправьте `/newapp` (или `Menu Button → Configure`) и укажите URL вашего приложения (например, после деплоя на Vercel/Netlify)

## Настройка реальной оплаты

### Переменные окружения на Vercel

В настройках проекта на Vercel → **Settings → Environment Variables** добавьте:

| Переменная | Где получить | Назначение |
|---|---|---|
| `BOT_TOKEN` | @BotFather → `/mybots` → выберите бота → **API Token** | Доступ к Bot API, создание инвойсов |
| `PROVIDER_TOKEN` | @BotFather → `/mybots` → выберите бота → **Payments** | Оплата картой (ЮKassa и др.) |

### Telegram Stars (⭐)

1. В @BotFather отправьте `/mybots` → выберите бота → **Stars Mode → Enable**
2. Убедитесь, что `BOT_TOKEN` задан на Vercel
3. Оплата звёздами готова — кнопка «Telegram Stars» в оформлении заказа

### Банковская карта (ЮKassa и др.)

1. В @BotFather: `/mybots` → выберите бота → **Payments**
2. Выберите провайдера (ЮKassa — для РФ, Stripe — для других стран)
3. Следуйте инструкциям провайдера для подключения магазина
4. BotFather выдаст **токен провайдера** — добавьте его как `PROVIDER_TOKEN` на Vercel
5. Оплата картой готова

### Как это работает

1. Пользователь нажимает «Оплатить» в оформлении заказа
2. Фронтенд вызывает `/api/create-invoice` (Vercel Serverless Function)
3. Бэкенд вызывает Telegram `createInvoiceLink` API с нужной валютой
4. Telegram возвращает ссылку на инвойс
5. Фронтенд вызывает `tg.openInvoice(link)` — открывается нативное окно оплаты
6. После успешной оплаты заказ сохраняется и показывается страница успеха

### Локальное тестирование

Serverless-функции можно тестировать локально:

```bash
npm i -g vercel
vercel dev
```

## Структура проекта

```
├── api/              # Vercel Serverless Functions
│   ├── _helpers.ts   # Авторизация + БД хелперы
│   ├── admin-auth.ts # Авторизация админа
│   ├── dashboard.ts  # Статистика
│   ├── seed.ts       # Инициализация БД
│   ├── create-invoice.ts # Создание счёта для оплаты
│   ├── products/     # CRUD товаров
│   ├── orders/       # CRUD заказов
│   └── users/        # Список пользователей
├── db/
│   └── schema.sql    # Схема базы данных
├── src/
│   ├── admin/        # Админ-панель
│   │   ├── AdminApp.tsx     # Роутинг + layout
│   │   ├── AdminLogin.tsx   # Страница входа
│   │   ├── Dashboard.tsx    # Дашборд со статистикой
│   │   ├── ProductsAdmin.tsx # Управление товарами
│   │   ├── OrdersAdmin.tsx   # Управление заказами
│   │   ├── UsersAdmin.tsx    # Пользователи
│   │   └── Settings.tsx      # Настройки / инициализация БД
│   ├── components/   # UI-компоненты Mini App
│   ├── context/      # Состояние (корзина, избранное, заказы)
│   ├── data/         # Каталог товаров
│   ├── hooks/        # Хуки (BackButton)
│   ├── lib/          # Telegram SDK обёртка
│   ├── pages/        # Страницы Mini App
│   ├── types/        # TypeScript типы
│   └── utils/        # Утилиты
```

## Админ-панель

Доступна по адресу `ваш-домен/admin` — для управления с компьютера.

### Настройка

1. **Создайте базу данных Vercel Postgres:**
   - Vercel Dashboard → ваш проект → **Storage → Create Database → Postgres**
   - База подключится к проекту автоматически

2. **Добавьте переменные окружения:**

   | Переменная | Назначение |
   |---|---|
   | `BOT_TOKEN` | Токен бота от @BotFather |
   | `ADMIN_KEY` | Любой секретный ключ для входа в админку (придумайте сами) |

3. **Инициализируйте БД:**
   - Откройте `ваш-домен/admin`
   - Введите `ADMIN_KEY` для входа
   - Перейдите в **Настройки** → введите свой Telegram ID → **Инициализировать БД**
   - Узнать Telegram ID: [@userinfobot](https://t.me/userinfobot)

4. Готово! Управляйте товарами, заказами и пользователями

### Доступ по Telegram ID

После инициализации БД с вашим Telegram ID вы также можете открывать админку внутри Telegram Mini App по адресу `ваш-домен/admin` — авторизация пройдёт автоматически через initData.
