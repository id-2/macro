import { describe, expect, it } from 'vitest';
import { callWorkAccounts, dmWorkAccount } from './work-visibility';

const isAgentAccount = (id: string) => id === 'rox|agent@example.com';

describe('dmWorkAccount', () => {
  it('picks the other account when it is an agent', () => {
    expect(
      dmWorkAccount({
        isDirectMessage: true,
        participantIds: ['rox|me@example.com', 'rox|agent@example.com'],
        viewerId: 'rox|me@example.com',
        isAgentAccount,
      })
    ).toBe('rox|agent@example.com');
  });

  it('shows nothing in a DM with a person', () => {
    expect(
      dmWorkAccount({
        isDirectMessage: true,
        participantIds: ['rox|me@example.com', 'rox|person@example.com'],
        viewerId: 'rox|me@example.com',
        isAgentAccount,
      })
    ).toBeUndefined();
  });

  it('shows nothing in a group or a channel', () => {
    expect(
      dmWorkAccount({
        isDirectMessage: true,
        participantIds: [
          'rox|me@example.com',
          'rox|agent@example.com',
          'rox|person@example.com',
        ],
        viewerId: 'rox|me@example.com',
        isAgentAccount,
      })
    ).toBeUndefined();
    expect(
      dmWorkAccount({
        isDirectMessage: false,
        participantIds: ['rox|me@example.com', 'rox|agent@example.com'],
        viewerId: 'rox|me@example.com',
        isAgentAccount,
      })
    ).toBeUndefined();
  });
});

describe('callWorkAccounts', () => {
  it('ignores guests and repeat connections, whatever the join order', () => {
    expect(
      callWorkAccounts([
        'rox|b@example.com',
        undefined,
        'rox|a@example.com',
        'rox|b@example.com',
      ])
    ).toEqual(['rox|a@example.com', 'rox|b@example.com']);
  });
});
