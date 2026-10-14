import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { EmptyState } from "../components/EmptyState";
export function ProfileSettings() {
  const { user, loading, submit, logout, miniApp } = useAuth(),
    { theme, setTheme } = useTheme(),
    navigate = useNavigate();
  const [name, setName] = useState(user?.firstName ? user.name : ""),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(""),
    [feedback, setFeedback] = useState<{
      section: string;
      error: boolean;
      text: string;
    } | null>(null);
  useEffect(() => {
    setName(user?.firstName ? user.name : "");
    setFeedback(null);
  }, [user?.id]);
  const message = (section: string) =>
    feedback?.section === section ? (
      <p
        role={feedback.error ? "alert" : "status"}
        className={`text-sm ${feedback.error ? "text-red-400" : "text-tg-link"}`}
      >
        {feedback.text}
      </p>
    ) : null;
  const save = async (e: React.FormEvent, section: string) => {
    e.preventDefault();
    if (busy) return;
    setFeedback(null);
    if (section === "password" && password !== repeat) {
      setFeedback({ section, error: true, text: "Пароли не совпадают" });
      return;
    }
    setBusy(section);
    try {
      const updated = await submit(
        section === "name"
          ? "update-profile"
          : user?.email
            ? "change-password"
            : "attach-email",
        section === "name"
          ? { name }
          : { email, password, currentPassword: current },
      );
      if (section === "name") setName(updated.firstName);
      else {
        setPassword("");
        setRepeat("");
        setCurrent("");
      }
      setFeedback({
        section,
        error: false,
        text:
          section === "name"
            ? "Имя сохранено"
            : user?.email
              ? "Пароль изменён. Другие сеансы завершены."
              : "Email и пароль добавлены",
      });
    } catch (e) {
      setFeedback({
        section,
        error: true,
        text: e instanceof Error ? e.message : "Не удалось сохранить изменения",
      });
    } finally {
      setBusy("");
    }
  };
  if (loading)
    return (
      <div className="app-container settings-page p-4">
        <p>Загружаем настройки…</p>
      </div>
    );
  if (!user)
    return (
      <div className="app-container settings-page p-4">
        <Link className="text-sm text-tg-link" to="/profile">
          ← Профиль
        </Link>
        <EmptyState
          icon="👤"
          title="Войдите в аккаунт"
          description="Настройки доступны после входа"
          actionLabel="Войти"
          onAction={() => navigate("/auth?next=/profile/settings")}
        />
      </div>
    );
  return (
    <div className="app-container settings-page">
      <header className="px-4 pt-4 pb-5">
        <Link to="/profile" className="text-sm text-tg-link inline-block mb-3">
          ← Профиль
        </Link>
        <h1 className="text-xl font-bold">Настройки</h1>
        <p className="text-sm text-tg-hint mt-2">
          Личные данные, безопасность и оформление
        </p>
      </header>
      <main className="scroll-area px-4">
        <div className="settings-grid">
          <section className="section-card p-5 settings-personal">
            <h2 className="text-base font-semibold mb-4">Личные данные</h2>
            <form className="space-y-4" onSubmit={(e) => void save(e, "name")}>
              <label className="block text-sm">
                Имя
                <input
                  className="input mt-2"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <p className="text-xs text-tg-hint">
                Так мы будем обращаться к вам в магазине.
              </p>
              {message("name")}
              <button
                className="btn-primary w-full sm:w-auto"
                disabled={
                  !!busy ||
                  !name.trim() ||
                  name.trim() === (user.firstName ? user.name : "")
                }
              >
                {busy === "name" ? "Сохраняем…" : "Сохранить имя"}
              </button>
            </form>
          </section>
          <section className="section-card p-5 settings-security">
            <h2 className="text-base font-semibold mb-4">
              {user.email ? "Пароль и безопасность" : "Вход в браузере"}
            </h2>
            {user.email ? (
              <p className="text-sm text-tg-hint mb-4 break-all">
                {user.email}
              </p>
            ) : (
              <p className="text-sm text-tg-hint mb-4">
                Добавьте email и пароль, чтобы пользоваться этим аккаунтом и
                историей покупок на сайте.
              </p>
            )}
            <form
              className="space-y-4"
              onSubmit={(e) => void save(e, "password")}
            >
              {user.email ? (
                <label className="block text-sm">
                  Текущий пароль
                  <input
                    className="input mt-2"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  Email
                  <input
                    className="input mt-2"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              <label className="block text-sm">
                {user.email ? "Новый пароль" : "Пароль"}
                <input
                  className="input mt-2"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="text-xs text-tg-hint block mt-2">
                  От 10 до 128 символов
                </span>
              </label>
              <label className="block text-sm">
                Повторите пароль
                <input
                  className="input mt-2"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </label>
              {message("password")}
              <button
                className="btn-primary w-full sm:w-auto"
                disabled={!!busy}
              >
                {busy === "password"
                  ? "Сохраняем…"
                  : user.email
                    ? "Изменить пароль"
                    : "Добавить email и пароль"}
              </button>
            </form>
          </section>
          <section className="section-card p-5 settings-appearance">
            <h2 className="text-base font-semibold mb-4">Оформление</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "dark" as const, label: "Тёмная", icon: "🌙" },
                { value: "light" as const, label: "Светлая", icon: "☀️" },
              ].map((t) => (
                <button
                  key={t.value}
                  aria-pressed={theme === t.value}
                  onClick={() => setTheme(t.value)}
                  className={`py-3 rounded-xl text-sm font-semibold ${theme === t.value ? "bg-tg-button text-tg-button-text" : "bg-tg-secondary-bg text-tg-text"}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </section>
          {!miniApp && (
            <section className="section-card p-5 settings-session">
              <h2 className="text-base font-semibold mb-3">
                Выход из аккаунта
              </h2>
              <p className="text-sm text-tg-hint mb-4">
                История покупок сохранится. Вы сможете открыть её после
                следующего входа.
              </p>
              {message("logout")}
              <button
                className="btn-secondary w-full sm:w-auto"
                disabled={!!busy}
                onClick={() => {
                  setBusy("logout");
                  void logout()
                    .then(() => navigate("/auth"))
                    .catch((e) =>
                      setFeedback({
                        section: "logout",
                        error: true,
                        text: e.message,
                      }),
                    )
                    .finally(() => setBusy(""));
                }}
              >
                {busy === "logout" ? "Выходим…" : "Выйти из аккаунта"}
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
