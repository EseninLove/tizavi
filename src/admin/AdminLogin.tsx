import { useState } from "react";
import { authApi } from "./api";
import { AdminIcon, AdminNotice } from "./AdminUI";
export function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [diagnostic, setDiagnostic] = useState<{
      ok: boolean;
      text: string;
    } | null>(null),
    [checking, setChecking] = useState(false);
  const login = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await authApi.loginWithKey(key.trim());
      if (d.ok) onLogin();
      else setError(d.error || "Не удалось войти");
    } catch {
      setError("Нет соединения с сервером. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };
  const check = async () => {
    setChecking(true);
    setDiagnostic(null);
    try {
      const r = await fetch("/api/categories"),
        d = await r.json();
      setDiagnostic({
        ok: r.ok && d.ok,
        text:
          r.ok && d.ok
            ? "Соединение с магазином работает. Это проверка связи, для входа нужен ключ."
            : "Не удалось проверить соединение. Повторите позже.",
      });
    } catch {
      setDiagnostic({ ok: false, text: "Нет соединения с магазином." });
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="admin-login">
      <section className="admin-login-panel">
        <div className="admin-stat-icon mb-5">
          <AdminIcon name="shield" />
        </div>
        <h1>Tizavi</h1>
        <p className="mb-7 mt-1">Вход в управление магазином</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label htmlFor="admin-key">Ключ администратора</label>
          <input
            id="admin-key"
            type="password"
            autoComplete="current-password"
            className="admin-input"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError("");
            }}
            placeholder="Введите ваш ключ"
            required
          />
          {error && (
            <div className="mt-4">
              <AdminNotice>{error}</AdminNotice>
              <p>
                Если ключ изменён в Vercel, сохраните его для Production и
                опубликуйте последнюю версию.
              </p>
            </div>
          )}
          <button
            className="admin-primary"
            type="submit"
            disabled={busy || !key.trim()}
          >
            {busy ? "Проверяем…" : "Войти в админку"}
            <AdminIcon name="chevron" />
          </button>
        </form>
        <details className="admin-login-diagnostics">
          <summary>Не получается войти?</summary>
          <p className="my-3">
            Проверьте ключ и раскладку клавиатуры. Соединение можно проверить
            отдельно.
          </p>
          <button
            className="admin-button"
            disabled={checking}
            onClick={() => void check()}
          >
            {checking ? "Проверяем…" : "Проверить соединение"}
          </button>
          {diagnostic && (
            <div className="mt-3">
              <AdminNotice tone={diagnostic.ok ? "success" : "error"}>
                {diagnostic.text}
              </AdminNotice>
            </div>
          )}
        </details>
      </section>
    </div>
  );
}
