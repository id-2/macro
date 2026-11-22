import { formatLocale } from '@app/lib/i18n';
import { utc } from '@date-fns/utc';
import { format, parseISO } from 'date-fns';

/** Calendar dates from the overview are already local `YYYY-MM-DD`. Treat them
 *  as UTC so `date-fns` never applies a second viewer time zone. */
export const OVERVIEW_TZ = utc;

/** The same zone as an `Intl` id: `OVERVIEW_TZ` is a `date-fns` `in` context,
 *  not a time-zone name, so `Intl.DateTimeFormat` needs this one. */
export const OVERVIEW_TIME_ZONE = 'UTC';

export function parseOverviewDate(date: string): Date {
  return utc(parseISO(`${date}T00:00:00Z`));
}

export function formatOverviewDate(date: Date): string {
  return format(date, 'yyyy-MM-dd', { in: OVERVIEW_TZ });
}

/** Russian month names shorten to three letters with a period («янв.»,
 *  «фев.», «ноя.»); a name that is already three letters («май») stands as
 *  it is. */
const RUSSIAN_MONTH_LETTERS = 3;

function isRussianLocale(locale: string): boolean {
  try {
    return new Intl.Locale(locale).language === 'ru';
  } catch {
    return locale.toLowerCase().startsWith('ru');
  }
}

/**
 * The month name above the contribution axis: narrow enough for a one-cell
 * column but still legible. Russian takes its own three-letter abbreviation,
 * because `Intl`'s short month there is a single letter in some builds and
 * four letters in others («февр.», «нояб.»), neither of which fits the axis.
 * Every other language keeps `Intl`'s short month.
 */
export function formatMonthAxisLabel(date: string): string {
  const locale = formatLocale();
  const day = parseOverviewDate(date);
  if (!isRussianLocale(locale)) {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      timeZone: OVERVIEW_TIME_ZONE,
    }).format(day);
  }
  const name = new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: OVERVIEW_TIME_ZONE,
  }).format(day);
  return name.length <= RUSSIAN_MONTH_LETTERS
    ? name
    : `${name.slice(0, RUSSIAN_MONTH_LETTERS)}.`;
}

/**
 * A weekday sample beside the contribution grid: `Intl`'s short weekday with
 * a capital first letter, so Russian reads «Пн», «Ср», «Пт» rather than the
 * single letters the narrow form gives.
 */
export function formatWeekdayAxisLabel(date: Date): string {
  const locale = formatLocale();
  const label = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: OVERVIEW_TIME_ZONE,
  }).format(date);
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}
