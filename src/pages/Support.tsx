import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../lib/telegram';
import { formatDate } from '../utils/format';

interface MyTicket {
  id: number;
  subject: string;
  message: string;
  reply: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Открыта', cls: 'bg-amber-500/15 text-amber-500' },
  in_progress: { label: 'В работе', cls: 'bg-blue-500/15 text-blue-500' },
  resolved: { label: 'Решена', cls: 'bg-green-500/15 text-green-500' },
  closed: { label: 'Закрыта', cls: 'bg-tg-secondary-bg text-tg-hint' },
};

const SUBJECTS = [
  'Проблема с оплатой',
  'Проблема с заказом',
  'Вопрос по подписке',
  'Вопрос по товару',
  'Другое',
];

export function Support() {
  const navigate = useNavigate();
  const { haptic, webApp, user } = useTelegram();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const finalSubject = subject === 'Другое' ? customSubject : subject;

  const loadTickets = async () => {
    const initData = webApp?.initData;
    if (!initData) return;
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, action: 'my' }),
      });
      const data = await res.json();
      if (data.ok) setTickets(data.tickets || []);
    } catch {
      // история недоступна
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webApp]);

  const handleSubmit = async () => {
    if (sending) return;
    if (!finalSubject.trim() || !message.trim()) {
      setError('Заполните тему и опишите проблему');
      return;
    }
    const initData = webApp?.initData;
    if (!initData) {
      setError('Отправка доступна только внутри Telegram');
      return;
    }

    setSending(true);
    setError('');
    haptic.impact('medium');

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, subject: finalSubject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        haptic.notify('success');
        setMessage('');
        setCustomSubject('');
        setSent(true);
        await loadTickets();
      } else {
        setError(data.error || 'Не удалось отправить заявку');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-container">
      <header className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/profile')}
          className="text-sm text-tg-button font-medium mb-1 active:scale-95 transition-transform"
        >
          ← Профиль
        </button>
        <h1 className="text-xl font-bold text-tg-text">Поддержка</h1>
      </header>

      <main className="scroll-area px-4 space-y-4">
        {sent && (
          <div className="section-card p-4 flex items-center gap-3 border-green-500/30">
            <span className="w-10 h-10 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-xl shrink-0">
              ✓
            </span>
            <div>
              <div className="text-sm font-bold text-tg-text">Заявка отправлена</div>
              <div className="text-xs text-tg-hint mt-0.5">
                Ответ придёт вам в Telegram от бота поддержки
              </div>
            </div>
          </div>
        )}

        <div className="section-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-tg-text">Новая заявка</h2>

          <div>
            <label className="block text-xs text-tg-hint mb-1.5">Тема *</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    haptic.select();
                    setSubject(s);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                    subject === s
                      ? 'bg-tg-button text-tg-buttonText'
                      : 'bg-tg-secondary-bg text-tg-hint'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {subject === 'Другое' && (
              <input
                className="input mt-2"
                placeholder="Укажите тему"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                maxLength={100}
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-tg-hint mb-1">Сообщение *</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Опишите проблему подробно: номер заказа, что произошло..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
            />
            <p className="text-xs text-tg-hint mt-1 text-right">{message.length}/2000</p>
          </div>

          {user && (
            <p className="text-xs text-tg-hint">
              Заявка будет отправлена от вашего имени
              {user.username ? ` (@${user.username})` : ` (ID: ${user.id})`}
            </p>
          )}

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim() || !finalSubject.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {sending ? 'Отправка...' : 'Отправить заявку'}
          </button>
        </div>

        {tickets.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-tg-text px-1">Мои заявки</h2>
            {tickets.map((t) => {
              const info = STATUS_LABELS[t.status] || { label: t.status, cls: 'bg-tg-secondary-bg text-tg-hint' };
              return (
                <div key={t.id} className="section-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-tg-text">
                        №{t.id} · {t.subject}
                      </div>
                      <div className="text-xs text-tg-hint">{formatDate(new Date(t.created_at).getTime())}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-md shrink-0 ${info.cls}`}>
                      {info.label}
                    </span>
                  </div>
                  <p className="text-sm text-tg-text leading-relaxed">{t.message}</p>
                  {t.reply && (
                    <div className="mt-2 p-3 rounded-xl bg-tg-secondary-bg">
                      <div className="text-xs font-semibold text-tg-text mb-1">Ответ поддержки:</div>
                      <p className="text-sm text-tg-hint leading-relaxed">{t.reply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-2" />
      </main>
    </div>
  );
}
