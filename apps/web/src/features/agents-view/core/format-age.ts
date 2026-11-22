import { formatLocale, t } from '@app/lib/i18n';

/**
 * How long ago something moved, at the width a list row can spare: `now`,
 * `4m`, `3h`, `2d`, then a short date, in the interface language. Empty when
 * the time is unknown.
 */
export function compactAge(timestamp: number, now = Date.now()): string {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return t('common.timeNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('common.timeMinutesShort', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('common.timeHoursShort', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t('common.timeDaysShort', { count: days });
  return new Date(timestamp).toLocaleDateString(formatLocale(), {
    month: 'short',
    day: 'numeric',
  });
}

/** The sentence form for card footers: `just now`, `4 min ago`, `3 h ago`, `2 d ago`. */
export function relativeAge(timestamp: number, now = Date.now()): string {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return t('common.timeJustNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('common.timeMinutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('common.timeHoursAgo', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t('common.timeDaysAgo', { count: days });
  return new Date(timestamp).toLocaleDateString(formatLocale(), {
    month: 'short',
    day: 'numeric',
  });
}
