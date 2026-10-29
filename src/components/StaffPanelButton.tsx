import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTelegram } from "../lib/telegram";
import { authApi } from "../admin/api";
import { staffHome, staffPanelLabel } from "../shared/staff";
export function StaffPanelButton() {
  const { user, refresh } = useAuth(),
    { webApp } = useTelegram(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!user?.staffRole) return null;
  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await authApi.loginWithAccount(webApp?.initData || "");
      if (!r.ok) {
        void refresh();
        throw new Error(r.error);
      }
      navigate(staffHome(r.user.role));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось открыть рабочую панель",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="profile-staff-panel">
      <button
        className="btn-primary w-full"
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? "Открываем панель…" : staffPanelLabel(user.staffRole)}{" "}
        <span aria-hidden="true">↗</span>
      </button>
      {error && (
        <p className="text-sm text-red-500 mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
