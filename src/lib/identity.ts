const STORAGE_KEY = "crowdlist-anon-id";

export function getAnonymousId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, value);
  return value;
}
