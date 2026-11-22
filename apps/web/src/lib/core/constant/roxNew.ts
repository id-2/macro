/**
 * Identity for the agent-session half of Rox. Mirrors
 * `bot_id::ROX_NEW_BOT_ID` on the backend. A distinct bot from the classic
 * chat reply (see `roxAgent.ts`) because one id cannot mean both, but not a
 * distinct persona: both are "Rox", and the chat-v3 rollout decides which of
 * the two a single `@rox` mention targets.
 */
export const ROX_NEW_BOT_ID = '00000000-0000-0000-0000-00000000a2a2';

/**
 * Canonical principal id for the agent-session Rox bot, matching the
 * `bot|<uuid>` form used for bot senders and participants everywhere else.
 */
export const ROX_NEW_PRINCIPAL_ID = `bot|${ROX_NEW_BOT_ID}`;

/**
 * Whether an id refers to the agent-session Rox bot. Accepts both the bare
 * UUID and the `bot|<uuid>` participant/sender form.
 */
export function isRoxNewId(id: string | undefined): boolean {
  if (!id) return false;
  const bare = id.startsWith('bot|') ? id.slice('bot|'.length) : id;
  return bare === ROX_NEW_BOT_ID;
}
