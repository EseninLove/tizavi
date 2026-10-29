let adminUser: { role: string } | null = null;
// Remove permanent credentials left by older releases without reusing them.
for (const key of [
  "tizavi_admin_auth",
  "tizavi_admin_type",
  "tizavi_admin_role",
]) {
  localStorage.removeItem(key);
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (response.status === 401 && !path.startsWith("/api/admin-auth")) {
    adminUser = null;
    window.dispatchEvent(new Event("tizavi-admin-expired"));
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: `Сервер вернул статус ${response.status}` } as T;
  }
}

// Авторизация
export const authApi = {
  restore: async () => {
    const data = await apiFetch<any>("/api/admin-auth");
    adminUser = data.ok ? data.user : null;
    return !!adminUser;
  },
  loginWithKey: async (adminKey: string) => {
    const data = await apiFetch<any>("/api/admin-auth", {
      method: "POST",
      body: JSON.stringify({ adminKey }),
    });
    if (data.ok) adminUser = data.user;
    return data;
  },
  loginWithTelegram: async (initData: string) => {
    const data = await apiFetch<any>("/api/admin-auth", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    if (data.ok) adminUser = data.user;
    return data;
  },
  logout: async () => {
    const data = await apiFetch<any>("/api/admin-auth", {
      method: "POST",
      body: JSON.stringify({ action: "logout" }),
    });
    if (!data.ok) throw new Error(data.error || "Не удалось выйти");
    adminUser = null;
  },
  role: () => adminUser?.role || "",
  isAuthed: () => !!adminUser,
};

// Dashboard
export const dashboardApi = {
  get: () => apiFetch<any>("/api/dashboard"),
};

// Товары
export const productsApi = {
  list: () => apiFetch<any>("/api/products"),
  create: (data: Record<string, unknown>) =>
    apiFetch<any>("/api/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<any>(`/api/products?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiFetch<any>(`/api/products?id=${id}`, { method: "DELETE" }),
};

// Категории
export const categoriesApi = {
  list: () => apiFetch<any>("/api/categories"),
  create: (data: Record<string, unknown>) =>
    apiFetch<any>("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<any>(`/api/categories?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    apiFetch<any>(`/api/categories?id=${id}`, { method: "DELETE" }),
};

// Заказы
export const ordersApi = {
  list: (status?: string) =>
    apiFetch<any>(`/api/orders${status ? `?status=${status}` : ""}`),
  updateStatus: (id: number, status: string) =>
    apiFetch<any>(`/api/orders?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
};

// Пользователи
export const usersApi = {
  list: () => apiFetch<any>("/api/users"),
};

// Администраторы
export const adminsApi = {
  list: () => apiFetch<any>("/api/admins"),
  add: (telegramId: number, role?: string, name = "") =>
    apiFetch<any>("/api/admins", {
      method: "POST",
      body: JSON.stringify({ telegramId, role, name }),
    }),
  update: (id: number, name: string, role: string) =>
    apiFetch<any>(`/api/admins?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, role }),
    }),
  remove: (id: number) =>
    apiFetch<any>(`/api/admins?id=${id}`, { method: "DELETE" }),
};

// Сидирование
export const seedApi = {
  init: () =>
    apiFetch<any>("/api/seed", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
