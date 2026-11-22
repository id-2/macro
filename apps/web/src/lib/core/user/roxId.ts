/**
 * Branded type for RoxId strings.
 * Format: `macro|email@domain.com`
 */
declare const RoxIdBrand: unique symbol;
export type RoxId = string & { readonly [RoxIdBrand]: never };

/**
 * Type guard to check if a string is a valid RoxId.
 */
export function isRoxId(str: string): str is RoxId {
  return str.startsWith('macro|') && str.slice(6).includes('@');
}

/**
 * Attempts to parse a string as a RoxId.
 * Returns the RoxId if valid, undefined otherwise.
 */
export function tryRoxId(str: string): RoxId | undefined {
  return isRoxId(str) ? str : undefined;
}

/**
 * Extracts the email from a RoxId.
 */
export function roxIdToEmail(id: RoxId): string {
  return id.slice(6);
}

/**
 * Creates a RoxId from an email address.
 * Returns undefined if the email is invalid.
 */
export function emailToRoxId(email: string): RoxId | undefined {
  if (!email.includes('@')) {
    return undefined;
  }
  return `macro|${email}` as RoxId;
}
