import { useEffect, useRef, type ReactNode } from "react";
export function AdminIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, string> = {
    home: "M3 10 12 3l9 7v10h-6v-7H9v7H3Z",
    orders: "M3 3h2l2 13h12l2-10H6 M9 20h.01 M18 20h.01",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    products: "m12 3 9 5v9l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v9",
    categories: "M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z",
    reviews: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z",
    payments: "M3 5h18v14H3Z M3 9h18 M6 15h4",
    delivery:
      "M2 5h12v12H2Z M14 9h4l4 4v4h-8 M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    support:
      "M3 14v-2a9 9 0 0 1 18 0v2 M3 12h4v7H3Z M17 12h4v7h-4Z M21 19c0 3-4 3-7 3",
    settings:
      "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    search: "M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    refresh: "M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 14 6 M18 18a8 8 0 0 1-14-6",
    close: "M6 6l12 12 M18 6 6 18",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    external: "M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7",
    logout: "M9 3H3v18h6 M14 7l5 5-5 5 M8 12h11",
    check: "m5 12 4 4L19 6",
    clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    chevron: "m9 5 7 7-7 7",
    plus: "M12 5v14 M5 12h14",
    arrow: "M12 19V5 M5 12l7-7 7 7",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z m-4 9 3 3 5-6",
  };
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.settings} />
    </svg>
  );
}
export function AdminHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="admin-header-actions">{children}</div>
    </header>
  );
}
export function AdminSearch({
  value,
  onChange,
  placeholder = "Поиск",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="admin-search">
      <AdminIcon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Очистить поиск" onClick={() => onChange("")}>
          <AdminIcon name="close" />
        </button>
      )}
    </div>
  );
}
export function AdminTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="admin-tabs" role="group" aria-label="Фильтр раздела">
      {tabs.map((t) => (
        <button
          key={t.id}
          aria-pressed={value === t.id}
          className={value === t.id ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function AdminNotice({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`admin-notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function AdminEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="admin-empty">
      <AdminIcon name="search" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
export function AdminDetail({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null),
    closeRef = useRef<HTMLButtonElement>(null),
    onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && window.innerWidth < 1100) {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href],summary",
        );
        if (els?.length) {
          const first = els[0],
            last = els[els.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handle);
    const old = document.body.style.overflow;
    if (window.innerWidth < 1100) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  return (
    <>
      <button
        className="admin-detail-backdrop"
        onClick={onClose}
        aria-label="Закрыть подробности"
      />
      <aside ref={ref} className="admin-detail" aria-label={title}>
        <div className="admin-detail-heading">
          <h2>{title}</h2>
          <button
            ref={closeRef}
            className="admin-icon-button"
            onClick={onClose}
            aria-label="Закрыть панель"
          >
            <AdminIcon name="close" />
          </button>
        </div>
        <div className="admin-detail-content">{children}</div>
        {footer && <div className="admin-detail-footer">{footer}</div>}
      </aside>
    </>
  );
}
export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`admin-badge ${tone}`}>{children}</span>;
}
export function AdminPager({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="admin-pager">
      <span>
        {total} записей · Страница {page} из {pages}
      </span>
      <div>
        <button
          className="admin-button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Назад
        </button>
        <button
          className="admin-button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}
export function adminDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}
export function moscowDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function useAdminModal(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const modal = document.querySelector<HTMLElement>(
      '.admin-root [role="dialog"]',
    );
    const before = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea,select,a[href]",
        ) || [],
      ).filter((el) => el.getClientRects().length);
    focusables()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab") {
        const els = focusables(),
          first = els[0],
          last = els[els.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      before?.focus();
    };
  }, [open]);
}
