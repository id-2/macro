import { setInterfaceLanguage } from '@app/lib/i18n';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatMonthAxisLabel, formatWeekdayAxisLabel } from './activity-dates';
import { buildContributionGrid } from './contribution-grid';

/** Monday, Wednesday and Friday of a Sunday-first sample week. */
const WEEKDAY_SAMPLES = [1, 3, 5].map(
  (offset) => new Date(Date.UTC(2024, 0, 7 + offset))
);

describe('Russian contribution axis labels', () => {
  beforeAll(() => setInterfaceLanguage('ru'));

  it('writes months as three letters with a period', () => {
    expect(
      [
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
        '2026-11-01',
        '2026-12-01',
      ].map(formatMonthAxisLabel)
    ).toEqual(['янв.', 'фев.', 'мар.', 'ноя.', 'дек.']);
  });

  it('keeps a month name that is already three letters', () => {
    expect(formatMonthAxisLabel('2026-05-01')).toBe('май');
  });

  it('writes weekdays as two letters', () => {
    expect(WEEKDAY_SAMPLES.map(formatWeekdayAxisLabel)).toEqual([
      'Пн',
      'Ср',
      'Пт',
    ]);
  });

  it('anchors the abbreviations to the month-start columns', () => {
    const grid = buildContributionGrid({
      from: '2026-01-07',
      to: '2026-03-03',
      days: [],
    });

    expect(
      grid.monthLabels.map(({ label, weekIndex }) => [label, weekIndex])
    ).toEqual([
      ['янв.', 0],
      ['фев.', 4],
      ['мар.', 8],
    ]);
  });
});

describe('English contribution axis labels', () => {
  beforeAll(() => setInterfaceLanguage('en'));

  it('keeps the short month and short weekday', () => {
    expect(formatMonthAxisLabel('2026-01-01')).toBe('Jan');
    expect(WEEKDAY_SAMPLES.map(formatWeekdayAxisLabel)).toEqual([
      'Mon',
      'Wed',
      'Fri',
    ]);
  });
});
