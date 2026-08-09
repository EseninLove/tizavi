export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  image: string;
  images?: string[];
  category: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  badge?: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderDelivery {
  name: string;
  phone: string;
  address: string;
  city: string;
  comment?: string;
  deliveryType: 'courier' | 'pickup';
}

export type PaymentMethod = 'stars' | 'telegram-pay';

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  delivery: OrderDelivery;
  paymentMethod: PaymentMethod;
  createdAt: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered';
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}
