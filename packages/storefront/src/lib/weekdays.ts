// Shared helpers for the weekly-order flow. The cart groups items by
// `forDate` (YYYY-MM-DD); these helpers compute the upcoming weekdays
// the customer can order for, and format dates consistently across the
// menu modal, the cart drawer, and the checkout summary.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function ymd(date: Date): string {
  // Local YYYY-MM-DD — using toISOString would shift to UTC and pick
  // the wrong day for late-evening picks near midnight.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/// Returns the next `count` weekdays (Mon–Fri) starting tomorrow. If
/// tomorrow is Sat/Sun we skip ahead to Monday — Inka kitchen runs
/// Mon–Fri only.
export function upcomingWeekdays(count = 5, from: Date = new Date()): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (out.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(cursor));
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
  }
  return out;
}

export function defaultForDate(): string {
  return ymd(upcomingWeekdays(1)[0]);
}

export function formatDayLabel(date: Date, locale: string = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatDayLabelFromYmd(s: string, locale?: string): string {
  return formatDayLabel(parseYmd(s), locale);
}
