export function normalizeId(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const stringValue = String(value).trim();
  return stringValue ? stringValue : undefined;
}

export function normalizeDateLabel(value?: string | number | Date | null, fallback = '—') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function normalizeDateTimeLabel(value?: string | number | Date | null, fallback = '—') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function normalizeStatusLabel(value?: string | null, fallback = '—') {
  if (!value) return fallback;
  return String(value).trim().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function normalizeNotificationType<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const raw = String(value || '').trim().toLowerCase();
  const match = allowed.find((item) => item.toLowerCase() === raw);
  return match ?? fallback;
}
