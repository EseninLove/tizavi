import { useEffect, useState } from "react";
export const PRIVACY_VERSION = "2026-10-14";
export interface PrivacyOperator {
  operator_name: string;
  inn: string;
  address: string;
  contact_email: string;
  retention: string;
  recipients: string;
  updated_at?: string;
}
export function usePrivacyOperator() {
  const [operator, setOperator] = useState<PrivacyOperator | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let stopped = false;
    fetch("/api/privacy")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.ok) throw Error();
        if (!stopped) setOperator(d.operator);
      })
      .catch(() => {
        if (!stopped) setError(true);
      });
    return () => {
      stopped = true;
    };
  }, []);
  return { operator, error };
}
export const privacyKinds = {
  access: "Получить сведения о моих данных",
  correction: "Исправить данные",
  withdrawal: "Отозвать согласие / прекратить обработку",
  deletion: "Запросить удаление аккаунта и данных",
};
export const privacyStatuses = {
  open: "Принято",
  in_progress: "В работе",
  answered: "Ответ дан",
};
