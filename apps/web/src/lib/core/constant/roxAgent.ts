import { displayName } from '@core/constant/brand';

/**
 * Identity for the first-party Rox system bot. Mirrors
 * `bot_id::ROX_AI_BOT_ID` on the backend. Rox is a global system bot
 * available in every channel; mentioning it triggers an AI reply in a thread.
 */
export const ROX_AGENT_BOT_ID = '00000000-0000-0000-0000-00000000a1a1';

/**
 * Canonical principal id for Rox, matching the `bot|<uuid>` form used for
 * bot senders and participants everywhere else. New mentions must always use
 * this form; the bare UUID is only accepted for historical content.
 */
export const ROX_AGENT_PRINCIPAL_ID = `bot|${ROX_AGENT_BOT_ID}`;

/** Display name for Rox. */
export const ROX_AGENT_NAME = displayName;

/**
 * User-facing name for Rox's built-in harness (`in-memory` / `rox-inmem`).
 * Wire slugs stay as they are; this is only what the UI prints.
 */
export const ROX_HARNESS_NAME = `${displayName} Agent`;

/** Handle used to find Rox in the mention typeahead (`@rox`). */
export const ROX_AGENT_HANDLE = 'rox';

/**
 * Whether an id refers to the Rox bot. Accepts both the bare UUID and
 * the `bot|<uuid>` participant/sender form.
 */
export function isMacroAgentId(id: string | undefined): boolean {
  if (!id) return false;
  const bare = id.startsWith('bot|') ? id.slice('bot|'.length) : id;
  return bare === ROX_AGENT_BOT_ID;
}

/**
 * Whether an id is a bot principal: the canonical `bot|<uuid>` form used for
 * bot senders, participants, and mentions, or the Rox bot's bare UUID
 * (accepted for historical content only).
 */
export function isBotPrincipalId(id: string | undefined): boolean {
  return id?.startsWith('bot|') === true || isMacroAgentId(id);
}
