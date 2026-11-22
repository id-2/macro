import { CODEX_BOT_PRINCIPAL_ID } from '@core/constant/codexAgent';
import {
  ROX_AGENT_NAME,
  ROX_AGENT_PRINCIPAL_ID,
} from '@core/constant/macroAgent';
import {
  ROX_CODER_BOT_ID,
  ROX_CODER_NAME,
  ROX_CODER_PRINCIPAL_ID,
} from '@core/constant/macroCoder';
import { ROX_NEW_PRINCIPAL_ID } from '@core/constant/macroNew';
import type { IUser } from '@core/user/types';
import { createRoot, createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { codexMentionUser } from './macroAi';
import { useAgentMentionUsers } from './use-agent-mention-users';

const flags = vi.hoisted(() => ({
  agents: (): boolean => false,
  codex: (): boolean => false,
  cursor: (): boolean => false,
}));
vi.mock('@core/constant/featureFlags', () => ({
  enableChatV3Agents: { key: 'enable-chat-v3-agents' },
  enableCodexAgents: { key: 'enable-codex-agents' },
  enableCursorAgents: { key: 'enable-cursor-agents' },
}));
vi.mock('@app/lib/analytics/posthog', () => ({
  useFeatureFlag: (flag: { key: string }) => () => ({
    enabled:
      flag.key === 'enable-chat-v3-agents'
        ? flags.agents()
        : flag.key === 'enable-codex-agents'
          ? flags.codex()
          : flags.cursor(),
  }),
}));

function macroEntries(users: IUser[]): IUser[] {
  return users.filter((user) => user.name === ROX_AGENT_NAME);
}

describe('useAgentMentionUsers', () => {
  beforeEach(() => {
    flags.agents = () => false;
    flags.codex = () => false;
    flags.cursor = () => false;
  });

  it('offers Codex only within the agents and Codex rollouts, even when it is a participant', () => {
    createRoot((dispose) => {
      const [codex, setCodex] = createSignal(false);
      flags.agents = () => true;
      flags.codex = codex;
      const users = useAgentMentionUsers(() => [codexMentionUser()]);
      const codexIds = () =>
        users()
          .map((user) => user.id)
          .filter((id) => id === CODEX_BOT_PRINCIPAL_ID);
      expect(codexIds()).toEqual([]);
      setCodex(true);
      expect(codexIds()).toEqual([CODEX_BOT_PRINCIPAL_ID]);
      flags.agents = () => false;
      expect(codexIds()).toEqual([]);
      dispose();
    });
  });

  it('offers the classic Rox bot as the only Rox entry without the rollout', () => {
    createRoot((dispose) => {
      const users = useAgentMentionUsers(() => []);
      expect(macroEntries(users())).toEqual([
        {
          id: ROX_AGENT_PRINCIPAL_ID,
          name: ROX_AGENT_NAME,
          email: ROX_AGENT_NAME,
        },
      ]);
      dispose();
    });
  });

  it('points the same entry at the agent bot within the rollout', () => {
    createRoot((dispose) => {
      const [enabled, setEnabled] = createSignal(false);
      flags.agents = enabled;
      const users = useAgentMentionUsers(() => []);
      expect(macroEntries(users()).map((user) => user.id)).toEqual([
        ROX_AGENT_PRINCIPAL_ID,
      ]);
      setEnabled(true);
      expect(macroEntries(users()).map((user) => user.id)).toEqual([
        ROX_NEW_PRINCIPAL_ID,
      ]);
      dispose();
    });
  });

  it('keeps one Rox entry when the other Rox bot is already in the list', () => {
    createRoot((dispose) => {
      flags.agents = () => true;
      const users = useAgentMentionUsers(() => [
        {
          id: ROX_AGENT_PRINCIPAL_ID,
          name: 'Rox',
          email: 'Rox',
        },
        {
          id: ROX_NEW_PRINCIPAL_ID,
          name: 'macro(new)',
          email: 'macro(new)',
        },
      ]);
      expect(macroEntries(users()).map((user) => user.id)).toEqual([
        ROX_NEW_PRINCIPAL_ID,
      ]);
      dispose();
    });
  });

  it.each([false, true])(
    'excludes the retired coder with the agents rollout set to %s',
    (rollout) => {
      createRoot((dispose) => {
        flags.agents = () => rollout;
        const users = useAgentMentionUsers(() => []);
        expect(users().map((user) => user.id)).not.toContain(
          ROX_CODER_PRINCIPAL_ID
        );

        const person = {
          id: 'person',
          name: 'Person',
          email: 'person@example.com',
        };
        const [enabled, setEnabled] = createSignal(true);
        const participants = [
          person,
          ...[ROX_CODER_BOT_ID, ROX_CODER_PRINCIPAL_ID].map((id) => ({
            id,
            name: ROX_CODER_NAME,
            email: ROX_CODER_NAME,
          })),
        ];
        const mentions = useAgentMentionUsers(() => participants, enabled);
        expect(mentions()).toContainEqual(person);
        expect(mentions().map((user) => user.id)).not.toContain(
          ROX_CODER_BOT_ID
        );
        expect(mentions().map((user) => user.id)).not.toContain(
          ROX_CODER_PRINCIPAL_ID
        );
        setEnabled(false);
        expect(mentions()).toEqual([person]);
        expect(participants).toHaveLength(3);
        dispose();
      });
    }
  );
});
