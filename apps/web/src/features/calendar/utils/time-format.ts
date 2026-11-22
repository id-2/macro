import { formatLocale, interfaceLanguage } from '@app/lib/i18n';
import type { CalendarTimeFormat } from '../types';

/** FullCalendar and Intl options for the supported calendar time formats. */
export const CALENDAR_TIME_FORMAT_OPTIONS = {
  '12-hour': {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },
  '24-hour': {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
} satisfies Record<CalendarTimeFormat, Intl.DateTimeFormatOptions>;

// A clock is only a string-builder, so one instance per locale and format is
// reused; the locale comes from the interface, not the browser default.
const calendarTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function calendarTimeFormatter(
  timeFormat: CalendarTimeFormat,
  locale = formatLocale()
): Intl.DateTimeFormat {
  const key = `${locale}|${timeFormat}`;
  let formatter = calendarTimeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      locale,
      CALENDAR_TIME_FORMAT_OPTIONS[timeFormat]
    );
    calendarTimeFormatters.set(key, formatter);
  }
  return formatter;
}

const compactWholeHourFormatters = new Map<string, Intl.DateTimeFormat>();

function compactWholeHourFormatter(
  locale = formatLocale()
): Intl.DateTimeFormat {
  let formatter = compactWholeHourFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      hour12: true,
    });
    compactWholeHourFormatters.set(locale, formatter);
  }
  return formatter;
}

function compactDayPeriod(
  parts: Intl.DateTimeFormatPart[],
  showDayPeriod = true
) {
  return parts
    .map((part, index) => {
      if (part.type === 'dayPeriod') {
        return showDayPeriod ? part.value.toLocaleLowerCase() : '';
      }

      const previousPart = parts[index - 1];
      const nextPart = parts[index + 1];
      if (
        part.type === 'literal' &&
        part.value.trim() === '' &&
        (previousPart?.type === 'dayPeriod' || nextPart?.type === 'dayPeriod')
      ) {
        return '';
      }

      return part.value;
    })
    .join('');
}

/** Returns the clock the interface language writes, e.g. 24-hour for Russian. */
export function getDefaultCalendarTimeFormat(): CalendarTimeFormat {
  return new Intl.DateTimeFormat(formatLocale(), {
    hour: 'numeric',
  }).resolvedOptions().hour12 === false
    ? '24-hour'
    : '12-hour';
}

/**
 * The clock actually shown: Russian writes times in 24 hours, so a 12-hour
 * choice stored earlier (or copied from an English browser) never wins there.
 */
export function resolveCalendarTimeFormat(
  timeFormat: CalendarTimeFormat
): CalendarTimeFormat {
  return interfaceLanguage() === 'ru' ? '24-hour' : timeFormat;
}

/** Formats a time using the calendar's selected 12/24-hour preference. */
export function formatCalendarTime(date: Date, timeFormat: CalendarTimeFormat) {
  return calendarTimeFormatter(resolveCalendarTimeFormat(timeFormat)).format(
    date
  );
}

/** Formats event-card times compactly while preserving the selected clock. */
export function formatCompactCalendarTime(
  date: Date,
  timeFormat: CalendarTimeFormat,
  showDayPeriod = true
) {
  const effectiveFormat = resolveCalendarTimeFormat(timeFormat);
  if (effectiveFormat === '24-hour') {
    return calendarTimeFormatter(effectiveFormat).format(date);
  }

  const formatter =
    date.getMinutes() === 0
      ? compactWholeHourFormatter()
      : calendarTimeFormatter(effectiveFormat);
  return compactDayPeriod(formatter.formatToParts(date), showDayPeriod);
}

/** Formats an event-card range without repeating a shared AM/PM marker. */
export function formatCompactCalendarTimeRange(
  start: Date,
  end: Date,
  timeFormat: CalendarTimeFormat
) {
  const startIsAm = start.getHours() < 12;
  const endIsAm = end.getHours() < 12;
  const sharesDayPeriod =
    resolveCalendarTimeFormat(timeFormat) === '12-hour' &&
    startIsAm === endIsAm;

  return `${formatCompactCalendarTime(
    start,
    timeFormat,
    !sharesDayPeriod
  )}–${formatCompactCalendarTime(end, timeFormat)}`;
}
