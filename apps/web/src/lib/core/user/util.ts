import { getDisplayName } from './displayName';
import { tryRoxId } from './roxId';
import type { IUser } from './types';

// TODO: consolidate idToEmail, see idToEmail in email.ts
/**
 * Converts a user id to an email address.
 * @deprecated Use `roxIdToEmail` with a validated `RoxId` instead.
 */
export function idToEmail(id: string): string {
  return id.replace('rox|', '');
}

/**
 * Converts an email address to a user id.
 * @deprecated Use `emailToRoxId` instead for type-safe RoxId creation.
 */
export function emailToId(email: string): string {
  return `rox|${email}`;
}

export function idToDisplayName(id: string): string {
  return getDisplayName(tryRoxId(id), {
    emailFallback: 'local-part',
  });
}

export function channelParticipantInfo(participant: {
  user_id: string;
}): IUser {
  const id = participant.user_id;
  return {
    id,
    email: idToEmail(id),
    name: idToDisplayName(id),
  };
}
