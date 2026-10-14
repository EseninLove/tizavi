import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTelegram } from "../lib/telegram";
import { shopRequest } from "../lib/api";
import { formatDate } from "../utils/format";
import {
  privacyKinds,
  privacyStatuses,
  usePrivacyOperator,
} from "../lib/privacy";
interface PrivacyRequest {
  id: number;
  kind: keyof typeof privacyKinds;
  message: string;
  status: keyof typeof privacyStatuses;
  reply: string;
  created_at: string;
}
export function PrivacyCenter() {
  const { user, loading } = useAuth(),
    { webApp } = useTelegram(),
    { operator } = usePrivacyOperator();
  const [requests, setRequests] = useState<PrivacyRequest[]>([]),
    [kind, setKind] = useState<keyof typeof privacyKinds>("access"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const load = async () => {
    const d = await shopRequest<{ requests: PrivacyRequest[] }>(
      "/api/privacy",
      { action: "my", initData: webApp?.initData },
    );
    setRequests(d.requests);
  };
  useEffect(() => {
    setRequests([]);
    if (user) void load().catch((e) => setError(e.message));
  }, [user?.id]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await shopRequest("/api/privacy", {
        action: "create",
        kind,
        message,
        initData: webApp?.initData,
      });
      setMessage("");
      setFeedback(
        "Обращение принято. Ответ появится в истории ниже. Удаление данных или аккаунта этим действием автоматически не выполняется.",
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось отправить обращение",
      );
    } finally {
      setBusy(false);
    }
  };
  const clearDevice = () => {
    if (
      !window.confirm(
        "Очистить адрес, корзину, избранное и черновики на этом устройстве? Серверная история покупок сохранится.",
      )
    )
      return;
    for (const storage of [localStorage, sessionStorage])
      for (const key of Object.keys(storage))
        if (key.startsWith("tizavi_") && !key.startsWith("tizavi_admin_"))
          storage.removeItem(key);
    window.location.reload();
  };
  return (
    <div className="app-container privacy-page">
      <header>
        <Link to="/profile/settings">← Настройки</Link>
        <h1>Персональные данные</h1>
        <p>Информация, обращения и данные на устройстве</p>
      </header>
      <main className="scroll-area">
        <section>
          <h2>Как используются данные</h2>
          <p>
            Имя, контакты и адрес нужны для аккаунта, заказа и доставки.{" "}
            <Link to="/legal/privacy">Открыть политику обработки данных →</Link>
          </p>
          <p>
            Запросы обрабатывает владелец магазина. Часть сведений о покупках
            может сохраняться на законном основании после удаления аккаунта.
          </p>
          {operator?.contact_email && (
            <p>
              Можно обратиться без входа:{" "}
              <a href={`mailto:${operator.contact_email}`}>
                {operator.contact_email}
              </a>
              .
            </p>
          )}
        </section>
        {loading ? (
          <p>Проверяем аккаунт…</p>
        ) : user ? (
          <section>
            <h2>Отправить обращение</h2>
            <form onSubmit={submit}>
              <label>
                Что нужно сделать
                <select
                  className="input"
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as keyof typeof privacyKinds)
                  }
                >
                  {Object.entries(privacyKinds).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Уточнение (необязательно)
                <textarea
                  className="input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Не указывайте пароль, паспортные данные или реквизиты карты"
                />
              </label>
              <button disabled={busy} className="btn-primary">
                {busy ? "Отправляем…" : "Отправить запрос"}
              </button>
            </form>
          </section>
        ) : (
          <section>
            <h2>Обращение по вашему аккаунту</h2>
            <p>
              Войдите, чтобы защитить доступ к вашим данным и получить ответ в
              личном кабинете.
            </p>
            <Link className="btn-primary" to="/auth?next=/profile/privacy">
              Войти
            </Link>
            {!operator?.contact_email && (
              <p className="privacy-warning">
                Контакт для обращений без входа владелец магазина ещё не указал.
              </p>
            )}
          </section>
        )}
        {feedback && (
          <p role="status" className="privacy-feedback">
            {feedback}
          </p>
        )}
        {error && (
          <p role="alert" className="privacy-warning">
            {error}
          </p>
        )}
        {user && (
          <section>
            <h2>История обращений</h2>
            {!requests.length ? (
              <p>Обращений пока нет.</p>
            ) : (
              requests.map((r) => (
                <article key={r.id} className="privacy-request">
                  <h3>
                    №{r.id} · {privacyKinds[r.kind]}
                  </h3>
                  <p>
                    {formatDate(new Date(r.created_at).getTime())} ·{" "}
                    {privacyStatuses[r.status]}
                  </p>
                  {r.message && (
                    <p className="whitespace-pre-wrap">{r.message}</p>
                  )}
                  {r.reply && (
                    <p className="privacy-feedback whitespace-pre-wrap">
                      Ответ: {r.reply}
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        )}
        <section>
          <h2>Данные на этом устройстве</h2>
          <p>
            Можно очистить локальные корзину, избранное, адрес и черновики. Это
            не удаляет аккаунт или заказы на сервере.
          </p>
          <button className="btn-secondary" onClick={clearDevice}>
            Очистить данные на устройстве
          </button>
        </section>
      </main>
    </div>
  );
}
