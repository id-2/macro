import { CURSOR_BOT_ID } from '@core/constant/cursorAgent';
import { ROX_AGENT_BOT_ID } from '@core/constant/roxAgent';
import { ROX_CODER_BOT_ID } from '@core/constant/roxCoder';
import { ROX_NEW_BOT_ID } from '@core/constant/roxNew';
import type { AgentsMode } from './mode';

/**
 * What an agent is for. A coder writes code: it takes a repository and runs on
 * a coding runtime (Cursor's cloud agents, or a roxd daemon on someone's
 * machine). Every other agent chats from Rox's own in-memory harness.
 *
 * The kind is not stored on the agent — the harness decides it, because only a
 * coding runtime can actually do coding work.
 */
export type AgentKind = 'agent' | 'coder';

/** Harness slugs that run inside Rox's process, with no coding runtime. */
const CHAT_HARNESSES: ReadonlySet<string> = new Set([
  'in-memory',
  'rox-inmem',
]);

export function isCoderHarness(harness: string | null | undefined): boolean {
  if (!harness) return false;
  return !CHAT_HARNESSES.has(harness);
}

export function kindForHarness(harness: string | null | undefined): AgentKind {
  return isCoderHarness(harness) ? 'coder' : 'agent';
}

/** The first-party bots, whose kind is fixed by what mentioning them does. */
const SYSTEM_BOT_KINDS: ReadonlyMap<string, AgentKind> = new Map([
  [ROX_AGENT_BOT_ID, 'agent'],
  [ROX_NEW_BOT_ID, 'agent'],
  [ROX_CODER_BOT_ID, 'coder'],
  [CURSOR_BOT_ID, 'coder'],
]);

export function systemBotKind(
  botId: string | null | undefined
): AgentKind | undefined {
  if (!botId) return undefined;
  const bare = botId.startsWith('bot|') ? botId.slice('bot|'.length) : botId;
  return SYSTEM_BOT_KINDS.get(bare);
}

export function modeForKind(kind: AgentKind): AgentsMode {
  return kind === 'coder' ? 'code' : 'chat';
}

export function kindForMode(mode: AgentsMode): AgentKind {
  return mode === 'code' ? 'coder' : 'agent';
}

/** Display nouns for headings and buttons. */
export function agentKindNoun(kind: AgentKind, plural = false): string {
  const noun = kind === 'coder' ? 'coding agent' : 'agent';
  return plural ? `${noun}s` : noun;
}
