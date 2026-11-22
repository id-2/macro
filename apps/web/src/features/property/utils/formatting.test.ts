import {
  interfaceLanguageReady,
  setInterfaceLanguage,
} from '@app/lib/i18n';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatDate, formatTimeRange } from './formatting';

beforeAll(() => setInterfaceLanguage('en'));

describe('formatDate', () => {
  it('shows a day as its short month, day and year', () => {
    expect(formatDate(new Date(2025, 2, 14))).toBe('Mar 14, 2025');
    expect(formatDate(new Date(2026, 11, 1, 23, 59))).toBe('Dec 1, 2026');
  });
});

describe('formatTimeRange', () => {
  it('shows an all-day range as its days, sharing the month and year', () => {
    expect(
      formatTimeRange({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 13),
      })
    ).toBe('Oct 9\u2009–\u200913, 2026');
    expect(
      formatTimeRange({
        allDay: true,
        start: new Date(2026, 9, 9),
        end: new Date(2026, 9, 9),
      })
    ).toBe('Oct 9, 2026');
  });

  // ICU versions differ on the space before AM/PM; the range content is the contract.
  it('shows a timed range on one day as the day and both times', () => {
    expect(
      formatTimeRange({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 9, 17),
      }).replaceAll('\u202f', ' ')
    ).toBe('Oct 9, 9:00 AM\u2009–\u20095:00 PM');
  });

  it('shows a timed range over days as each day with its time', () => {
    expect(
      formatTimeRange({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 13, 17),
      }).replaceAll('\u202f', ' ')
    ).toBe('Oct 9, 9:00 AM\u2009–\u2009Oct 13, 5:00 PM');
  });
});

describe('in Russian', () => {
  beforeAll(async () => {
    setInterfaceLanguage('ru');
    await interfaceLanguageReady(5000);
  });

  afterAll(() => setInterfaceLanguage('en'));

  it('writes the month in Russian', () => {
    expect(formatDate(new Date(2025, 2, 14))).toBe('14 мар. 2025 г.');
  });

  it('writes the clock in 24-hour time', () => {
    expect(
      formatTimeRange({
        allDay: false,
        start: new Date(2026, 9, 9, 9),
        end: new Date(2026, 9, 9, 17),
      })
    ).toBe('9 окт., 09:00—17:00');
  });
});
