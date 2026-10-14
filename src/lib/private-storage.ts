const DAY = 24 * 60 * 60 * 1000;
export function readPrivate<T>(key: string): T | null {
  try {
    localStorage.removeItem(key);
    const record = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      !record ||
      !Number.isFinite(record.expiresAt) ||
      record.expiresAt <= Date.now()
    ) {
      sessionStorage.removeItem(key);
      return null;
    }
    return record.value as T;
  } catch {
    return null;
  }
}
export function writePrivate(
  key: string,
  value: unknown,
  expiresAt = Date.now() + DAY,
) {
  try {
    localStorage.removeItem(key);
    if (value === null) sessionStorage.removeItem(key);
    else
      sessionStorage.setItem(
        key,
        JSON.stringify({
          value,
          expiresAt: Math.min(expiresAt, Date.now() + DAY),
        }),
      );
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
}
export function clearPrivate() {
  for (const storage of [localStorage, sessionStorage])
    for (const key of [
      "tizavi_delivery",
      "tizavi_checkout_request",
      "tizavi_subscription_request",
    ])
      storage.removeItem(key);
  window.dispatchEvent(new Event("tizavi-private-data-cleared"));
}
