import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export function Auth() {
  const { user, submit, loading } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [mode, setMode] = useState(
      params.get("mode") === "attach"
        ? "attach-email"
        : params.get("mode") === "password"
          ? "change-password"
          : "login",
    ),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false);
  const creating = mode === "register" || mode === "attach-email",
    changing = mode === "change-password",
    next = params.get("next"),
    destination =
      next &&
      /^\/(?!\/)/.test(next) &&
      !next.startsWith("/auth") &&
      !next.includes("\\")
        ? next
        : "/profile";
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if ((creating || changing) && password !== repeat) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(mode, { name, email, password, currentPassword });
      navigate(destination, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };
  const title = changing
    ? "Изменить пароль"
    : mode === "attach-email"
      ? "Добавить вход по email"
      : creating
        ? "Создать аккаунт"
        : "Войти в магазин";
  return (
    <div className="app-container auth-page px-4 pt-6 pb-24">
      <Link to={user ? "/profile" : "/"} className="text-sm text-tg-hint mb-8">
        ← {user ? "Профиль" : "В магазин"}
      </Link>
      <div className="section-card p-6">
        <p className="text-tg-hint text-sm mb-2">Tizavi</p>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-tg-hint mb-6">
          {mode === "attach-email"
            ? "Добавим email и пароль к вашему текущему аккаунту, без подтверждения письмом."
            : creating
              ? "Регистрация без подтверждения: пользоваться аккаунтом можно сразу."
              : changing
                ? "Укажите текущий пароль и придумайте новый."
                : "Ваши заказы и подписка будут доступны в профиле."}
        </p>
        {loading ? (
          <p className="text-tg-hint">Проверяем аккаунт…</p>
        ) : user && mode !== "attach-email" && !changing ? (
          <>
            <p className="mb-4">Вы вошли как {user.name}</p>
            <Link className="btn-primary w-full" to="/profile">
              В профиль
            </Link>
          </>
        ) : (
          <form className="space-y-4" onSubmit={send}>
            {creating && mode === "register" && (
              <label className="block text-sm">
                Имя
                <input
                  className="input mt-2"
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </label>
            )}
            {!changing && (
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="input mt-2"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {changing && (
              <label className="block text-sm">
                Текущий пароль
                <input
                  className="input mt-2"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm">
              {changing ? "Новый пароль" : "Пароль"}
              <div className="relative mt-2">
                <input
                  type={visible ? "text" : "password"}
                  className="input pr-24"
                  autoComplete={
                    creating || changing ? "new-password" : "current-password"
                  }
                  required
                  minLength={creating || changing ? 10 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-xs text-tg-hint"
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? "Скрыть" : "Показать"}
                </button>
              </div>
              {(creating || changing) && (
                <span className="text-xs text-tg-hint mt-1 block">
                  От 10 до 128 символов
                </span>
              )}
            </label>
            {(creating || changing) && (
              <label className="block text-sm">
                Повторите пароль
                <input
                  type="password"
                  className="input mt-2"
                  autoComplete="new-password"
                  required
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="btn-primary w-full"
              type="submit"
            >
              {busy
                ? "Подождите…"
                : changing
                  ? "Сохранить пароль"
                  : mode === "attach-email"
                    ? "Добавить email и пароль"
                    : creating
                      ? "Создать аккаунт"
                      : "Войти"}
            </button>
            {(mode === "login" || mode === "register") && (
              <button
                type="button"
                className="w-full text-sm text-tg-link py-2"
                onClick={() => {
                  setMode(creating ? "login" : "register");
                  setError("");
                  setPassword("");
                  setRepeat("");
                }}
              >
                {creating
                  ? "Уже есть аккаунт? Войти"
                  : "Нет аккаунта? Зарегистрироваться"}
              </button>
            )}
          </form>
        )}
        {mode === "login" && (
          <p className="text-xs text-tg-hint mt-5">
            Восстановление пароля по письму появится после подключения почтового
            сервиса.
          </p>
        )}
        {mode === "attach-email" && (
          <p className="text-xs text-tg-hint mt-5">
            Этот email откроет ваш текущий профиль и историю Telegram в
            браузере. Если email уже занят, аккаунты автоматически не
            объединяются.
          </p>
        )}
      </div>
    </div>
  );
}
