import { Link } from "react-router-dom";
export function PrivacyNotice() {
  return (
    <p className="privacy-notice">
      Данные используются для работы аккаунта, исполнения заказа или ответа на
      обращение — в зависимости от формы.{" "}
      <Link to="/legal/privacy">Политика обработки данных</Link>.{" "}
      <Link to="/profile/privacy">Вопросы и запросы по данным</Link>.
    </p>
  );
}
