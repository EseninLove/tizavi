import { useEffect, useState } from 'react';
import { categoriesApi, productsApi } from './api';

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
}

interface ProductRow {
  id: number;
  category: string;
}

export function CategoriesAdmin() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [productList, setProductList] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([categoriesApi.list(), productsApi.list()]).then(([catRes, prodRes]) => {
      if (catRes.ok) setCategories(catRes.categories || []);
      if (prodRes.ok) setProductList(prodRes.products || []);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const countProducts = (slug: string) =>
    productList.filter((p) => p.category === slug).length;

  const openCreate = () => {
    setName('');
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (c: CategoryRow) => {
    setName(c.name);
    setEditing(c);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');

    try {
      let res;
      if (editing) {
        res = await categoriesApi.update(editing.id, { name: name.trim() });
      } else {
        res = await categoriesApi.create({ name: name.trim() });
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

  const handleDelete = async (c: CategoryRow) => {
    const count = countProducts(c.slug);
    const msg = count > 0
      ? `В категории «${c.name}» ${count} товаров. Удалить категорию? (товары останутся, но потеряют фильтр)`
      : `Удалить категорию «${c.name}»?`;
    if (!confirm(msg)) return;
    const res = await categoriesApi.remove(c.id);
    if (res.ok) load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Категории <span className="text-gray-400 text-lg">({categories.length})</span>
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
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-2">Категорий пока нет</p>
          <p className="text-sm text-gray-400">
            Добавьте первую категорию или инициализируйте БД в «Настройках»
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {categories.map((c) => (
              <div key={c.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-400">
                    slug: {c.slug} · {countProducts(c.slug)} товаров
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium active:scale-95 transition-all"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium active:scale-95 transition-all"
                  >
                    Удалить
                  </button>
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
            className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Редактировать категорию' : 'Новая категория'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  className="admin-input"
                  placeholder="Например: Овощи и фрукты"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 font-semibold text-gray-700 text-sm active:scale-95 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
