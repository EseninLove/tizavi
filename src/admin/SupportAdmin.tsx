import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { formatDate } from '../utils/format';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Открыта', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'В работе', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Решена', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Закрыта', color: 'bg-gray-100 text-gray-500' },
};

const STATUS_FLOW = ['open', 'in_progress', 'resolved', 'closed'];

interface TicketRow {
  id: number;
  telegram_id: number;
  username: string | null;
  user_name: string | null;
  subject: string;
  message: string;
  reply: string | null;
  status: string;
  created_at: string;
  replied_at: string | null;
}

export function SupportAdmin() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  const load = (status?: string) => {
    setLoading(true);
    apiFetch(`/api/support${status && status !== 'all' ? `?status=${status}` : ''}`).then((res) => {
      if (res.ok) setTickets(res.tickets || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const updateStatus = async (id: number, status: string) => {
    const res = await apiFetch(`/api/support?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setSelected(null);
      load(filter);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim() || replying) return;
    setReplying(true);
    const res = await apiFetch(`/api/support?id=${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({ reply: reply.trim() }),
    });
    if (res.ok) {
      setReply('');
      setSelected(null);
      load(filter);
    }
    setReplying(false);
  };

  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Поддержка{' '}
          <span className="text-gray-400 text-lg">
            ({tickets.length}
            {openCount > 0 && filter === 'all' ? `, новых: ${openCount}` : ''})
          </span>
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <FilterChip label="Все" active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUS_FLOW.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_LABELS[s]?.label || s}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">Загрузка...</div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Заявок нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const info = STATUS_LABELS[t.status] || { label: t.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div
                key={t.id}
                onClick={() => {
                  setSelected(t);
                  setReply(t.reply || '');
                }}
                className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-gray-300 transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900">
                      №{t.id} · {t.subject}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t.user_name || 'Пользователь'}
                      {t.username ? ` · @${t.username}` : ` · ID: ${t.telegram_id}`} ·{' '}
                      {formatDate(new Date(t.created_at).getTime())}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${info.color}`}>
                    {info.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{t.message}</p>
                {t.reply && (
                  <p className="text-xs text-green-600 mt-1.5">✓ Есть ответ</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">№{selected.id} · {selected.subject}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="text-xs text-gray-400">
                {selected.user_name || 'Пользователь'}
                {selected.username ? ` · @${selected.username}` : ''} · ID: {selected.telegram_id}
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </div>

              {selected.reply && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Предыдущий ответ</h3>
                  <div className="bg-green-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selected.reply}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Ответ (будет отправлен пользователю в Telegram)
                </h3>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none text-gray-900"
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Введите ответ пользователю..."
                  maxLength={3500}
                />
                <button
                  onClick={sendReply}
                  disabled={replying || !reply.trim()}
                  className="mt-2 w-full bg-gray-900 text-white font-semibold py-2.5 rounded-xl hover:bg-gray-800 active:scale-95 transition-all text-sm disabled:opacity-50"
                >
                  {replying ? 'Отправка...' : 'Отправить ответ'}
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Статус</h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW.map((s) => {
                    const info = STATUS_LABELS[s];
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                          selected.status === s
                            ? info.color + ' ring-2 ring-offset-1 ring-gray-300'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${
        active ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
