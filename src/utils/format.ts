export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function generateOrderId(): string {
  return 'ORD-' + Date.now().toString(36).toUpperCase();
}

export function formatQuantity(q: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(q);
}

export function formatWeight(kg: number): string {
  if (!kg || kg <= 0) return '';
  if (kg < 1) {
    const grams = Math.round(kg * 1000);
    return `${grams} г`;
  }
  return `${formatQuantity(kg)} кг`;
}

export function quantityStep(unit?: string): number {
  return unit === 'кг' || unit === 'л' ? 0.5 : 1;
}

export function quantityMin(unit?: string): number {
  return unit === 'кг' || unit === 'л' ? 0.5 : 1;
}

export function quantityLabel(unit?: string): string {
  if (unit === 'кг') return 'Вес, кг';
  if (unit === 'л') return 'Объём, л';
  return 'Количество';
}

export function basePricePerKg(price: number, unit?: string, weight?: number): number | null {
  if (unit === 'кг') return price;
  if (unit && unit !== 'кг' && weight && weight > 0) return price / weight;
  if (!unit && weight && weight > 0) return price / weight;
  return null;
}

export function pricePerKgLabel(price: number, unit?: string, weight?: number): string {
  const perKg = basePricePerKg(price, unit, weight);
  if (perKg === null) return '';
  const base = unit === 'л' ? 'л' : 'кг';
  return `${formatPrice(perKg)}/${base}`;
}

export function packLabel(unit?: string, weight?: number): string {
  if (unit === 'кг') return 'весовой';
  if (unit === 'л') return 'на розлив';
  if (weight && weight > 0) return formatWeight(weight);
  return '';
}
