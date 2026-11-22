import { type RoxId, roxIdToEmail, tryMacroId } from '@core/user/roxId';
import { validate as validEmail } from 'email-validator';

const UTF8 = new TextEncoder();
export const MAX_CONTACT_ID_BYTES = 1024;

/** Admit supported Rox identities, not every address accepted by email entry.
 * The Rust parser excludes '$' local parts; external addresses remain valid email recipients. */
export function canonicalContactUserId(value: string): RoxId | undefined {
  if (value.length > MAX_CONTACT_ID_BYTES) return;
  const id = tryMacroId(value.toLowerCase());
  return id &&
    !id.includes('$') &&
    UTF8.encode(id).length <= MAX_CONTACT_ID_BYTES &&
    validEmail(roxIdToEmail(id))
    ? id
    : undefined;
}
