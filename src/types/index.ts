export type ProductUnit = "кг" | "л" | "шт";
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
  actualReviewsCount?: number;
  adminRatingsCount?: number;
  inStock: boolean;
  badge?: string;
  unit?: ProductUnit;
  weight?: number;
  packageLabel?: string;
  brand?: string;
  synonyms?: string;
  seasonal?: boolean;
  popular?: boolean;
  purchaseCount?: number;
}
export interface Category {
  id: string;
  name: string;
  emoji?: string;
  image?: string;
}
export interface CartItem {
  product: Product;
  quantity: number;
  lineTotalMinor?: number;
}
export interface OrderDelivery {
  name: string;
  phone: string;
  address: string;
  city: string;
  addressId?: string;
  comment?: string;
  deliveryType: "courier" | "pickup";
  warehouseId?: number;
  earliestAt?: string;
  latestAt?: string;
  estimated?: boolean;
}
export type PaymentMethod =
  "yookassa" | "tbank" | "aggregator" | "telegram-pay" | "stars";
export type OrderStatus =
  "pending" | "paid" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "canceled" | "unverified";
export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  deliveryFee: number;
  payableTotal: number;
  delivery: OrderDelivery;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: number;
  status: OrderStatus;
}
export interface DeliveryQuote {
  addressId: string;
  address: string;
  city: string;
  warehouseId: number;
  warehouseName: string;
  fee: number;
  estimated: boolean;
  earliestAt: string;
  latestAt: string;
  distanceKm: number;
}
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}
