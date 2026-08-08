import type { Category, Product } from '../types';

export const categories: Category[] = [
  { id: 'all', name: 'Все', emoji: '🛍️' },
  { id: 'electronics', name: 'Электроника', emoji: '📱' },
  { id: 'clothing', name: 'Одежда', emoji: '👕' },
  { id: 'home', name: 'Для дома', emoji: '🏠' },
  { id: 'beauty', name: 'Красота', emoji: '💄' },
  { id: 'sports', name: 'Спорт', emoji: '⚽' },
  { id: 'books', name: 'Книги', emoji: '📚' },
];

const img = (seed: string, text: string) =>
  `https://dummyimage.com/600x630/2481cc/ffffff.png&text=${encodeURIComponent(text)}${encodeURIComponent(' #' + seed)}`;

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Беспроводные наушники AirSound Pro',
    description:
      'Премиальные беспроводные наушники с активным шумоподавлением, до 36 часов автономной работы и кристально чистым звуком. Поддержка Bluetooth 5.3, быстрая зарядка.',
    price: 12990,
    oldPrice: 18990,
    image: img('p1', 'AirSound Pro'),
    category: 'electronics',
    rating: 4.8,
    reviewsCount: 1243,
    inStock: true,
    badge: '-32%',
  },
  {
    id: 'p2',
    name: 'Умные часы SmartWatch X5',
    description:
      'Смарт-часы с AMOLED-дисплеем, измерением пульса и SpO2, GPS, более 100 спортивных режимов. Водозащита 5 ATM.',
    price: 8990,
    oldPrice: 13990,
    image: img('p2', 'SmartWatch X5'),
    category: 'electronics',
    rating: 4.6,
    reviewsCount: 856,
    inStock: true,
    badge: '-36%',
  },
  {
    id: 'p3',
    name: 'Портативная колонка SoundBoom',
    description:
      'Мощная Bluetooth-колонка с глубоким басом, водонепроницаемым корпусом IPX7 и автономностью до 24 часов.',
    price: 4990,
    image: img('p3', 'SoundBoom'),
    category: 'electronics',
    rating: 4.7,
    reviewsCount: 432,
    inStock: true,
  },
  {
    id: 'p4',
    name: 'Худи оверсайз Urban Style',
    description:
      'Стильное худи из плотного хлопка футер 3-х нитка. Свободный крой, мягкий начёс внутри. Унисекс.',
    price: 3490,
    oldPrice: 4990,
    image: img('p4', 'Urban Hoodie'),
    category: 'clothing',
    rating: 4.5,
    reviewsCount: 210,
    inStock: true,
    badge: 'Хит',
  },
  {
    id: 'p5',
    name: 'Кроссовки Runner Air',
    description:
      'Лёгкие беговые кроссовки с дышащим верхом и амортизирующей подошвой. Идеальны для бега и повседневной носки.',
    price: 5990,
    image: img('p5', 'Runner Air'),
    category: 'sports',
    rating: 4.4,
    reviewsCount: 167,
    inStock: true,
  },
  {
    id: 'p6',
    name: 'Набор керамической посуды (6 пр.)',
    description:
      'Элегантный набор тарелок из высококачественной керамики. Подходит для СВЧ и посудомоечной машины.',
    price: 2790,
    oldPrice: 3500,
    image: img('p6', 'Ceramic Set'),
    category: 'home',
    rating: 4.9,
    reviewsCount: 598,
    inStock: true,
    badge: '-20%',
  },
  {
    id: 'p7',
    name: 'Аромадиффузор Aroma Mist',
    description:
      'Ультразвуковой увлажнитель-аромадиффузор с подсветкой. Создаёт уютную атмосферу в любом помещении.',
    price: 1990,
    image: img('p7', 'Aroma Mist'),
    category: 'home',
    rating: 4.3,
    reviewsCount: 89,
    inStock: true,
  },
  {
    id: 'p8',
    name: 'Набор для ухода за кожей Glow',
    description:
      'Полный набор средств для ежедневного ухода: очищающий гель, тоник, увлажняющий крем и сыворотка с витамином C.',
    price: 4290,
    oldPrice: 5500,
    image: img('p8', 'Glow Set'),
    category: 'beauty',
    rating: 4.7,
    reviewsCount: 345,
    inStock: true,
    badge: '-22%',
  },
  {
    id: 'p9',
    name: 'Фен для волос Pro Dryer',
    description:
      'Профессиональный фен мощностью 2200 Вт с ионизацией и регулировкой температуры и скорости потока.',
    price: 6490,
    image: img('p9', 'Pro Dryer'),
    category: 'beauty',
    rating: 4.6,
    reviewsCount: 112,
    inStock: false,
  },
  {
    id: 'p10',
    name: 'Книга «Глубокая работа»',
    description:
      'Бестселлер Кэла Ньюпорта о правилах сфокусированной работы в мире, полном отвлечений. Твёрдый переплёт, 320 стр.',
    price: 690,
    image: img('p10', 'Deep Work'),
    category: 'books',
    rating: 4.8,
    reviewsCount: 2104,
    inStock: true,
    badge: 'Топ',
  },
  {
    id: 'p11',
    name: 'Йога-коврик Eco Grip',
    description:
      'Нескользящий коврик для йоги из экологичного TPE. Толщина 6 мм, отличная амортизация. С ремнём в комплекте.',
    price: 1490,
    oldPrice: 2200,
    image: img('p11', 'Eco Grip'),
    category: 'sports',
    rating: 4.5,
    reviewsCount: 276,
    inStock: true,
    badge: '-32%',
  },
  {
    id: 'p12',
    name: 'Портативный внешний аккумулятор 20000mAh',
    description:
      'Power Bank с быстрой зарядкой PD 22.5 Вт, цифровым дисплеем заряда и двумя портами USB-C + USB-A.',
    price: 2290,
    image: img('p12', 'Power Bank'),
    category: 'electronics',
    rating: 4.7,
    reviewsCount: 689,
    inStock: true,
  },
];

export function getProductsByCategory(categoryId: string): Product[] {
  if (categoryId === 'all') return products;
  return products.filter((p) => p.category === categoryId);
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  );
}
