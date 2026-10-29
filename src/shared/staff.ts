export const STAFF_ROLES = {
  super_admin: {
    label: "Владелец",
    description: "Все разделы, сотрудники, оплата и настройки магазина.",
  },
  admin: {
    label: "Администратор",
    description:
      "Заказы, покупатели, каталог, отзывы, поддержка и доставка. Без управления сотрудниками и закрытыми настройками.",
  },
  order_manager: {
    label: "Менеджер заказов",
    description:
      "Просмотр заказов, обработка, передача в доставку и завершение. Без каталога и настроек оплаты.",
  },
  catalog_manager: {
    label: "Менеджер каталога",
    description: "Товары, цены, наличие, категории и модерация отзывов.",
  },
  support: {
    label: "Специалист поддержки",
    description:
      "Обращения покупателей, ответы и модерация отзывов. Без списка покупателей и заказов.",
  },
  logistics: {
    label: "Логист",
    description:
      "Склады, курьеры, зоны и тарифы доставки. Без доступа к оплате и сотрудникам.",
  },
} as const;
export type StaffRole = keyof typeof STAFF_ROLES;
export type StaffPermission =
  | "overview"
  | "orders"
  | "customers"
  | "catalog"
  | "reviews"
  | "support"
  | "delivery"
  | "staff"
  | "settings";
const permissions: Record<StaffRole, readonly StaffPermission[]> = {
  super_admin: [
    "overview",
    "orders",
    "customers",
    "catalog",
    "reviews",
    "support",
    "delivery",
    "staff",
    "settings",
  ],
  admin: [
    "overview",
    "orders",
    "customers",
    "catalog",
    "reviews",
    "support",
    "delivery",
  ],
  order_manager: ["orders"],
  catalog_manager: ["catalog", "reviews"],
  support: ["support", "reviews"],
  logistics: ["delivery"],
};
export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STAFF_ROLES, value)
  );
}
export function hasStaffPermission(role: unknown, permission: StaffPermission) {
  return isStaffRole(role) && permissions[role].includes(permission);
}
export function staffRoleLabel(role: unknown) {
  return isStaffRole(role) ? STAFF_ROLES[role].label : "Неизвестная роль";
}
export function staffPageAllowed(role: unknown, path: string) {
  const pages: Record<string, StaffPermission> = {
    "/admin": "overview",
    "/admin/orders": "orders",
    "/admin/users": "customers",
    "/admin/products": "catalog",
    "/admin/categories": "catalog",
    "/admin/reviews": "reviews",
    "/admin/support": "support",
    "/admin/delivery": "delivery",
    "/admin/admins": "staff",
    "/admin/email": "settings",
    "/admin/payments": "settings",
    "/admin/privacy": "settings",
    "/admin/settings": "settings",
  };
  path = path.replace(/\/$/, "");
  return !!pages[path] && hasStaffPermission(role, pages[path]);
}
export function staffHome(role: unknown) {
  return (
    [
      "/admin",
      "/admin/orders",
      "/admin/products",
      "/admin/support",
      "/admin/delivery",
    ].find((path) => staffPageAllowed(role, path)) || "/admin"
  );
}
