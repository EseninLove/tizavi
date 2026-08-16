import { useEffect, useState, type ReactNode } from 'react';
import { productsApi, categoriesApi } from './api';
import { formatPrice, formatWeight } from '../utils/format';

const unitBadge = (p: { unit?: string; weight?: number | null }) => {
  if (p.unit === 'кг') return 'за 1 кг';
  if (p.unit === 'л') return 'за 1 л';
  if (p.weight) return `фасовка ${formatWeight(p.weight)}`;
  return 'шт';
};

interface ProductRow {
  id: number;
  name: string;
  description: string;
  price: number;
  old_price: number | null;
  image: string;
  category: string;
  rating: number;
  reviews_count: number;
  in_stock: boolean;
  badge: string | null;
  unit?: string;
  weight?: number | null;
}

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  old_price: '',
  image: '',
  category: '',
  rating: '5.0',
  reviews_count: '0',
  in_stock: true,
  badge: '',
  unit: 'шт',
  weight: '',
};

export function ProductsAdmin() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    productsApi.list().then((res) => {
      if (res.ok) setProducts(res.products);
      setLoading(false);
    });
    categoriesApi.list().then((res) => {
      if (res.ok) setCategories(res.categories || []);
    });
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p: ProductRow) => {
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      old_price: p.old_price ? String(p.old_price) : '',
      image: p.image,
      category: p.category,
      rating: String(p.rating),
      reviews_count: String(p.reviews_count),
      in_stock: p.in_stock,
      badge: p.badge || '',
      unit: p.unit || 'шт',
      weight: p.weight ? String(p.weight) : '',
    });
    setEditing(p);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      setError('Заполните название и цену');
      return;
    }
    setSaving(true);
    setError('');

    const data: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      old_price: form.old_price ? Number(form.old_price) : null,
      image: form.image.trim(),
      category: form.category || 'other',
      rating: Number(form.rating) || 5.0,
      reviews_count: Number(form.reviews_count) || 0,
      in_stock: form.in_stock,
      badge: form.badge.trim() || null,
      unit: form.unit,
      weight: form.unit === 'шт' && form.weight ? Number(form.weight) : null,
    };

    try {
      let res;
      if (editing) {
        res = await productsApi.update(editing.id, data);
      } else {
        res = await productsApi.create(data);
      }
      if (res.ok) {
        setShowForm(false);
        load();
      } else {
        setError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ProductRow) => {
    if (!confirm(`Удалить «${p.name}»?`)) return;
    const res = await productsApi.delete(p.id);
    if (res.ok) load();
  };

  const catName = (slug: string) => {
    const c = categories.find((cat) => cat.slug === slug);
    return c ? c.name : slug;
  };

  const perKgHint = (() => {
    const price = Number(form.price);
    const weight = Number(form.weight);
    if (!price) return '';
    if (form.unit === 'кг') return `Цена указана за 1 кг`;
    if (form.unit === 'л') return `Цена указана за 1 л`;
    if (weight > 0) return `= ${Math.round(price / weight)} ₽ за 1 кг`;
    return '';
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Товары <span className="text-gray-400 text-lg">({products.length})</span>
        </h1>
        <button
          onClick={openCreate}
          className="bg-gray-900 text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-800 active:scale-95 transition-all text-sm"
        >
          + Добавить
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">Загрузка...</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-2">Товаров пока нет</p>
          <p className="text-sm text-gray-400">
            Добавьте первый товар или инициализируйте БД в «Настройках»
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3">Товар</th>
                  <th className="px-4 py-3">Категория</th>
                  <th className="px-4 py-3">Цена</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{p.name}</div>
                          <div className="text-xs text-gray-400">{unitBadge(p)}</div>
                          {p.badge && <span className="text-xs text-blue-500">{p.badge}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{catName(p.category)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {formatPrice(p.price)}
                      {(p.unit === 'кг' || p.unit === 'л') && (
                        <span className="text-xs text-gray-400 font-normal">/{p.unit}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${p.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.in_stock ? 'В наличии' : 'Нет'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                          Изменить
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {products.map((p) => (
              <div key={p.id} className="p-4 flex items-center gap-3">
                <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{unitBadge(p)}</div>
                  <div className="text-sm font-semibold text-gray-700">
                    {formatPrice(p.price)}
                    {(p.unit === 'кг' || p.unit === 'л') && (
                      <span className="text-xs text-gray-400 font-normal">/{p.unit}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="text-blue-500 text-xs font-medium">Изменить</button>
                  <button onClick={() => handleDelete(p)} className="text-red-500 text-xs font-medium">Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Редактировать товар' : 'Новый товар'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <FormField label="Название *">
                <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormField>

              <FormField label="Описание">
                <textarea className="admin-input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Цена (₽) *">
                  <input type="number" className="admin-input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </FormField>
                <FormField label="Старая цена (₽)">
                  <input type="number" className="admin-input" value={form.old_price} onChange={(e) => setForm({ ...form, old_price: e.target.value })} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Единица продажи *">
                  <select
                    className="admin-input"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    <option value="шт">шт — штучной товар</option>
                    <option value="кг">кг — на вес</option>
                    <option value="л">л — на розлив</option>
                  </select>
                </FormField>
                <FormField label={form.unit === 'кг' ? 'Цена за 1 кг' : form.unit === 'л' ? 'Цена за 1 л' : 'Вес фасовки (кг)'}>
                  {form.unit === 'шт' ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="admin-input"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      placeholder="0.5 = 500 г"
                    />
                  ) : (
                    <div className="admin-input bg-gray-50 text-gray-500 select-none">—</div>
                  )}
                </FormField>
              </div>

              {perKgHint && (
                <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">{perKgHint}</div>
              )}

              <FormField label="URL изображения">
                <input className="admin-input" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Категория">
                  <select
                    className="admin-input"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="">— Выберите —</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Бейдж">
                  <input className="admin-input" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="-20%" />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Рейтинг">
                  <input type="number" step="0.1" className="admin-input" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
                </FormField>
                <FormField label="Кол-во отзывов">
                  <input type="number" className="admin-input" value={form.reviews_count} onChange={(e) => setForm({ ...form, reviews_count: e.target.value })} />
                </FormField>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.in_stock} onChange={(e) => setForm({ ...form, in_stock: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-gray-700">В наличии</span>
              </label>

              {error && <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-semibold text-gray-700 text-sm active:scale-95 transition-all">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
