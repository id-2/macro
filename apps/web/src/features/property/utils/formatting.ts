import { formatLocale, interfaceLanguage } from '@app/lib/i18n';
import { getPropertyOptionLabel } from '@entity/utils/task-properties';
import { NUMBER_DECIMAL_PLACES } from '../constants';
import type { DateRangeValue, Property, PropertyOptionValue } from '../types';

type PropertyValueUnion = string | number | Date | boolean;

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: NUMBER_DECIMAL_PLACES,
});

/**
 * Format a number with thousands separators and up to 4 decimal places
 * Uses exponential notation for numbers beyond safe integer range
 */
export function formatNumber(value: number): string {
  // Use exponential notation for numbers beyond 15 digits
  // 15 is the largest js can handle
  if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-15)) {
    return value.toExponential(NUMBER_DECIMAL_PLACES);
  }
  // Round to 4 decimal places and remove trailing zeros
  const rounded = parseFloat(value.toFixed(NUMBER_DECIMAL_PLACES));
  return NUMBER_FORMAT.format(rounded === 0 ? 0 : rounded);
}

// One formatter per locale: toLocaleDateString builds one per call,
// which a table of a thousand dates pays for a thousand times.
const DATE_FORMATS = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string): Intl.DateTimeFormat {
  let format = DATE_FORMATS.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    DATE_FORMATS.set(locale, format);
  }
  return format;
}

/**
 * Format a date value for display, in the interface language: `Mar 14, 2025`
 * in English, `14 мар. 2025 г.` in Russian.
 */
export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return dateFormat(formatLocale()).format(date);
}

const TIME_FORMATS = new Map<string, Intl.DateTimeFormat>();

/**
 * The locale's own clock, except Russian, which the interface shows in
 * 24-hour time. Keyed by locale and clock so a table reuses one formatter.
 */
function timeFormat(locale: string, hour12: boolean): Intl.DateTimeFormat {
  const key = `${locale}|${hour12 ? '12' : '24'}`;
  let format = TIME_FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12,
    });
    TIME_FORMATS.set(key, format);
  }
  return format;
}

/**
 * A time range, compact where its ends share a day, month or year: all day
 * `Oct 9 – 13, 2026`; timed `Oct 9, 9:00 AM – 5:00 PM` or
 * `Oct 9, 9:00 AM – Oct 13, 5:00 PM`. Follows the interface language, so
 * Russian reads `9 окт. 2026 г.` and `9 окт., 9:00 – 17:00`.
 */
export function formatTimeRange(range: DateRangeValue): string {
  const locale = formatLocale();
  if (range.allDay) {
    return dateFormat(locale).formatRange(range.start, range.end);
  }
  return timeFormat(locale, interfaceLanguage() === 'en').formatRange(
    range.start,
    range.end
  );
}

/**
 * Format a boolean value for display
 */
export function formatBoolean(value: boolean): string {
  return value ? 'True' : 'False';
}

/**
 * Extract domain from a URL for display
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Format a property value for display
 * Handles all value types including looking up select options by ID
 * Returns '—' for undefined/null values
 */
export const formatPropertyValue = (
  property: Property,
  value: PropertyValueUnion | string | null | undefined
): string => {
  // Handle undefined/null values
  if (value === undefined || value === null) {
    return '';
  }

  // For select types, value is an option ID - look it up in property.options
  if (
    property.valueType === 'SELECT_STRING' ||
    property.valueType === 'SELECT_NUMBER'
  ) {
    const optionId = typeof value === 'string' ? value : String(value);
    return formatOptionValueById(optionId, property.options);
  }

  if (property.valueType === 'DATE' && value instanceof Date) {
    return formatDate(value);
  }

  if (property.valueType === 'BOOLEAN' && typeof value === 'boolean') {
    return formatBoolean(value);
  }

  if (property.valueType === 'NUMBER' && typeof value === 'number') {
    return formatNumber(value);
  }

  let formattedValue = value.toString();

  // Filter out "macro|" prefix for system owner properties
  if (property.displayName === 'Owner') {
    formattedValue = formattedValue.replace('macro|', '');
  }

  return formattedValue;
};

/**
 * Format a property option value by looking up its UUID in the options list
 * Used when you have an option ID and need to display its value
 *
 * @param optionId - The UUID of the option
 * @param options - The property's options array (from property.options)
 * @returns Formatted display value or the ID if not found
 */
const formatOptionValueById = (
  optionId: string,
  options: Array<{ id: string; value: PropertyOptionValue }> | undefined
): string => {
  const option = options?.find((opt) => opt.id === optionId);
  if (option) return formatOptionValue(option);
  return getPropertyOptionLabel(optionId) ?? optionId;
};

/**
 * Format a property option value for display (used when you already have the option object)
 * Takes a PropertyOption object and extracts its display value
 */
export const formatOptionValue = (option: {
  value: PropertyOptionValue;
}): string => {
  const optionValue = option.value;
  if ('type' in optionValue && 'value' in optionValue) {
    if (optionValue.type === 'string') {
      return optionValue.value;
    }
    if (optionValue.type === 'number') {
      return optionValue.value.toString();
    }
  }
  return 'No value';
};

/**
 * Get the raw option value (for comparison/selection)
 * Takes a PropertyOption object and extracts its raw value
 */
const _getOptionValue = (option: { value: PropertyOptionValue }): string => {
  const optionValue = option.value;
  if ('type' in optionValue && 'value' in optionValue) {
    if (optionValue.type === 'string') {
      return optionValue.value;
    }
    if (optionValue.type === 'number') {
      return optionValue.value.toString();
    }
  }
  return '';
};
