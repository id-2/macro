import type en from './locales/en';

/** The full message catalog; English defines its shape. */
export type Dictionary = typeof en;

/**
 * A message that changes with a number, one form per plural category of the
 * language (`Intl.PluralRules`), chosen by the `count` parameter. English
 * writes `one` and `other`; Polish and Russian also need `few` and `many`.
 */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

type Message = string | PluralMessage;

/**
 * Whether a group is one plural message rather than a nested group. Only the
 * plural categories appear in a plural message, so a group that also names a
 * reason (`deletionReasons`, with its own `other`) is a group, not a plural.
 */
type IsPlural<Group> = [Exclude<keyof Group, Intl.LDMLPluralRule>] extends [
  never,
]
  ? Group extends { other: string }
    ? true
    : false
  : false;

/**
 * A translated catalogue at any depth. A message stays a string, a plural
 * message keeps its forms, and a nested group (`settingsAccount.bundleStatus`)
 * is an object of the same kind, so sub-groups translate like their namespace.
 */
type Translated<Group> = {
  [K in keyof Group]?: Group[K] extends string
    ? string
    : IsPlural<Group[K]> extends true
      ? PluralMessage
      : Translated<Group[K]>;
};

/**
 * A translated catalog. Keys a translation leaves out fall back to English,
 * so a new English message never blocks a change; the translation update
 * (`bun run i18n:status`) fills them in. A plural message stays plural.
 */
export type PartialDictionary = {
  [K in keyof Dictionary]?: Translated<Dictionary[K]>;
};

/** The message names inside a group, dot-joined for nested groups. */
type MessageNames<Group> = {
  [K in keyof Group & string]: Group[K] extends string
    ? K
    : IsPlural<Group[K]> extends true
      ? K
      : `${K}.${MessageNames<Group[K]>}`;
}[keyof Group & string];

/** `namespace.message`, e.g. `nav.home` or `settingsAccount.bundleStatus.idle`. */
export type TranslationKey = {
  [K in keyof Dictionary & string]: `${K}.${MessageNames<Dictionary[K]>}`;
}[keyof Dictionary & string];

/** The plural message names inside a group, dot-joined for nested groups. */
type PluralNames<Group> = {
  [K in keyof Group & string]: Group[K] extends string
    ? never
    : IsPlural<Group[K]> extends true
      ? K
      : `${K}.${PluralNames<Group[K]>}`;
}[keyof Group & string];

/** Keys whose message is plural, so `t` needs a `count`. */
export type PluralKey = {
  [K in keyof Dictionary & string]: `${K}.${PluralNames<Dictionary[K]>}`;
}[keyof Dictionary & string];

export type TranslationParams = Record<string, string | number>;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

export function lookupMessage(
  dictionary: PartialDictionary,
  key: TranslationKey
): Message | undefined {
  let node: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' || (typeof node === 'object' && node !== null)
    ? (node as Message)
    : undefined;
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** The form of `message` for `count` in `language`, else its `other` form. */
export function pluralForm(
  message: PluralMessage,
  count: number,
  language: string
): string {
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(language);
    pluralRules.set(language, rules);
  }
  return message[rules.select(count)] ?? message.other;
}

/**
 * Replaces `{{name}}` placeholders, writing numbers for `locale`
 * (`1.234` in German). Unknown placeholders stay visible.
 */
export function formatMessage(
  template: string,
  params: TranslationParams | undefined,
  locale?: string
): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    if (!(name in params)) return placeholder;
    const value = params[name];
    return typeof value === 'number'
      ? value.toLocaleString(locale)
      : String(value);
  });
}
