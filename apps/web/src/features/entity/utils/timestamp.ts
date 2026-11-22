import { formatLocale, t } from '@app/lib/i18n';
import type { DateValue } from '@core/util/date';
import {
  differenceInDays,
  differenceInHours,
  differenceInMilliseconds,
  differenceInMinutes,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  isSameYear,
  isToday,
  isYesterday,
  toDate,
} from 'date-fns';

const formatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(options: Intl.DateTimeFormatOptions) {
  const locale = formatLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

function time(value: DateValue): string {
  return dateFormatter({ hour: 'numeric', minute: '2-digit' }).format(
    toDate(value)
  );
}

function monthAndDay(value: DateValue): string {
  return dateFormatter({ month: 'short', day: 'numeric' }).format(
    toDate(value)
  );
}

function numericDate(value: DateValue): string {
  return dateFormatter({
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(toDate(value));
}

/**
 * Formats a timestamp into a human-readable string.
 * - Today: shows the time in the interface language's clock (24-hour in Russian)
 * - Same year: shows month and day
 * - Older: shows a short numeric date
 */
export function formatTimestamp(date: DateValue): string {
  const value = toDate(date);
  if (Number.isNaN(value.getTime())) return t('common.timeInvalid');
  if (isToday(value)) return time(value);

  if (isSameYear(value, new Date())) return monthAndDay(value);

  return numericDate(value);
}

/**
 * Formats a timestamp into a relative human-readable string.
 * - Under 60 minutes: "5 minutes ago"
 * - Under 24 hours: "3 hours ago"
 * - Yesterday: "14:30 yesterday"
 * - Older: shows the date
 */
export function formatRelativeTimestamp(
  date: DateValue,
  options?: { condensed?: boolean }
): string {
  const now = new Date();
  const condensed = options?.condensed ?? false;

  const minutesAgo = differenceInMinutes(now, date);

  if (minutesAgo < 1) {
    return t('common.timeJustNow');
  }

  if (minutesAgo < 60) {
    return t('common.timeMinutesAgo', { count: minutesAgo });
  }

  const hoursAgo = differenceInHours(now, date);

  if (hoursAgo < 24) {
    return t('common.timeHoursAgo', { count: hoursAgo });
  }

  if (isYesterday(date)) {
    return condensed
      ? t('common.timeYesterdayShort')
      : t('common.timeYesterdayAt', { time: time(date) });
  }

  if (isSameYear(date, now)) return monthAndDay(date);

  return numericDate(date);
}

/**
 * The shortest relative age for dense rows: `now`, `5m`, `17h`, `8d`, `3w`,
 * `1mo`, `2y`, in the interface language. An unparseable value is returned
 * as is.
 */
export function formatCompactRelativeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const ageMs = Math.max(0, differenceInMilliseconds(now, date));
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return t('common.timeNow');

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('common.timeMinutesShort', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.timeHoursShort', { count: hours });

  const days = differenceInDays(now, date);
  if (days < 7) return t('common.timeDaysShort', { count: Math.max(1, days) });

  const weeks = differenceInWeeks(now, date);
  if (weeks < 5) {
    return t('common.timeWeeksShort', { count: Math.max(1, weeks) });
  }

  const months = differenceInMonths(now, date);
  if (months < 12) {
    return t('common.timeMonthsShort', { count: Math.max(1, months) });
  }

  return t('common.timeYearsShort', {
    count: Math.max(1, differenceInYears(now, date)),
  });
}

/**
 * Formats a date + time in a single concise line, e.g. "Apr 15, 2:30 PM" or
 * "15 апр., 14:30". Used when a row needs both pieces (e.g. routine
 * next-run times).
 */
export function formatDateAndTime(date: DateValue): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFormatter({
    year: isSameYear(d, new Date()) ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
