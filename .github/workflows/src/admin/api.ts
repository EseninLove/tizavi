const STORAGE_KEY = 'tizavi_admin_auth';
const STORAGE_TYPE = 'tizavi_admin_type';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem(STORAGE_KEY);
  const type = localStorage.getItem(STORAGE_TYPE) || 'Key';
  if (!token) return {};
  return { 'x-admin-auth': `${type} ${token}` };
}

async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  return data as T;
}

// Авторизация
export const authApi = {
  loginWithKey: async (adminKey: string) => {
    const data = await apiFetch<any>('/api/admin-auth', {
      method: 'POST',
      body: JSON.stringify({ adminKey }),
    });
    if (data.ok) {
      localStorage.setItem(STORAGE_KEY, adminKey);
      localStorage.setItem(STORAGE_TYPE, 'Key');
    }
    return data;
  },

  loginWithTelegram: async (initData: string) => {
    const data = await apiFetch<any>('/api/admin-auth', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
    if (data.ok) {
      localStorage.setItem(STORAGE_KEY, initData);
      localStorage.setItem(STORAGE_TYPE, 'Telegram');
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TYPE);
  },

  isAuthed: () => !!localStorage.getItem(STORAGE_KEY),
};

// Dashboard
export const dashboardApi = {
  get: () => apiFetch<any>('/api/dashboard'),
};

// Товары
export const productsApi = {
  list: () => apiFetch<any>('/api/products'),
  create: (data: Record<string, unknown>) =>
    apiFetch<any>('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<any>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<any>(`/api/products/${id}`, { method: 'DELETE' }),
};

// Заказы
export const ordersApi = {
  list: (status?: string) =>
    apiFetch<any>(`/api/orders${status ? `?status=${status}` : ''}`),
  get: (id: number) => apiFetch<any>(`/api/orders/${id}`),
  updateStatus: (id: number, status: string) =>
    apiFetch<any>(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

// Пользователи
export const usersApi = {
  list: () => apiFetch<any>('/api/users'),
};

// Сидирование
export const seedApi = {
  init: (telegramId?: number) =>
    apiFetch<any>('/api/seed', {
      method: 'POST',
      body: JSON.stringify({ telegramId }),
    }),
};
