import { t } from '@app/lib/i18n';

export type SnoozeOption = {
  id: string;
  label: string;
  until: Date;
};

/** Use calendar dates, so morning stays at 9 AM across daylight saving changes. */
export function snoozePresets(now: Date): SnoozeOption[] {
  const morning = new Date(now);
  morning.setHours(9, 0, 0, 0);
  if (morning <= now) morning.setDate(morning.getDate() + 1);

  const monday = new Date(now);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);

  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  week.setHours(9, 0, 0, 0);

  return [
    {
      id: '30-minutes',
      label: t('settingsNotifications.snoozeFor30Min'),
      until: new Date(now.getTime() + 30 * 60_000),
    },
    {
      id: '1-hour',
      label: t('settingsNotifications.snoozeFor1Hour'),
      until: new Date(now.getTime() + 60 * 60_000),
    },
    {
      id: '3-hours',
      label: t('settingsNotifications.snoozeFor3Hours'),
      until: new Date(now.getTime() + 180 * 60_000),
    },
    {
      id: 'morning',
      label: t('settingsNotifications.snoozeUntilMorning'),
      until: morning,
    },
    {
      id: 'weekend',
      label:
        now.getDay() === 0 || now.getDay() >= 5
          ? t('settingsNotifications.snoozeForWeekend')
          : t('settingsNotifications.snoozeUntilMonday'),
      until: monday,
    },
    {
      id: 'week',
      label: t('settingsNotifications.snoozeForWeek'),
      until: week,
    },
  ];
}

export function formatSnoozeDeadline(
  until: Date | string,
  locale?: string
): string {
  const date = new Date(until);
  return new Intl.DateTimeFormat(locale, {
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
