import { describe, expect, it } from 'vitest';
import {
  AGENT_SETUP_PATH,
  desktopAuthCallbackUrl,
  postAuthTarget,
  readRedirectParam,
} from './post-auth-target';

const newUser = { tutorialComplete: false, isAgent: false };
const returningUser = { ...newUser, tutorialComplete: true };

describe('postAuthTarget', () => {
  it('sends a new invitee to the team invite', () => {
    expect(
      postAuthTarget({ ...newUser, redirect: '/team-invite?id=abc' })
    ).toEqual({ t: 'navigate', to: '/team-invite?id=abc' });
  });

  it.each([newUser, returningUser])(
    'enters the app with no deep link, whatever the tutorial flag says',
    (user) => {
      expect(postAuthTarget({ ...user, redirect: undefined })).toEqual({
        t: 'navigate',
        to: '/',
      });
    }
  );

  it.each([newUser, returningUser])(
    'returns to the deep link for %o',
    (user) => {
      expect(postAuthTarget({ ...user, redirect: '/meet/new' })).toEqual({
        t: 'navigate',
        to: '/meet/new',
      });
    }
  );

  it('keeps a path that only looks like an invite', () => {
    expect(
      postAuthTarget({ ...newUser, redirect: '/team-invites-archive' })
    ).toEqual({ t: 'navigate', to: '/team-invites-archive' });
  });

  it.each<[unknown]>([
    ['https://evil.example/team-invite'],
    ['//evil.example/team-invite'],
    ['/\\evil.example'],
    ['team-invite?id=abc'],
    [['/team-invite?id=abc']],
  ])('ignores an unsafe redirect %o', (redirect) => {
    expect(postAuthTarget({ ...returningUser, redirect })).toEqual({
      t: 'navigate',
      to: '/',
    });
  });

  it('sends an agent that has not finished setup to agent setup', () => {
    expect(
      postAuthTarget({
        ...newUser,
        isAgent: true,
        redirect: '/team-invite?id=abc',
      })
    ).toEqual({ t: 'navigate', to: AGENT_SETUP_PATH });
  });

  it('does not divert an agent that already has its token', () => {
    expect(
      postAuthTarget({
        ...newUser,
        tutorialComplete: true,
        isAgent: true,
        redirect: undefined,
      })
    ).toEqual({ t: 'navigate', to: '/' });
  });
});

/** What the app sees after the auth service reads `original_url` from its
 * query and, when `doubleDecode`, decodes it once more (`UrlEncoded<Url>`). */
function redirectAfterAuthService(callback: string, doubleDecode: boolean) {
  const returned = doubleDecode ? decodeURIComponent(callback) : callback;
  const url = new URL(`${returned}&token=code`);
  return readRedirectParam(url.searchParams.get('redirect'));
}

describe('desktopAuthCallbackUrl', () => {
  it.each([true, false])(
    'carries a redirect through the auth service (double decode: %o)',
    (doubleDecode) => {
      const redirect = '/team-invite?id=abc&source=email';
      const callback = desktopAuthCallbackUrl('rox:///login', redirect);
      expect(callback.startsWith('rox:///login?redirect=')).toBe(true);
      expect(redirectAfterAuthService(callback, doubleDecode)).toBe(redirect);
    }
  );

  it.each<[unknown]>([[null], ['https://evil.example'], ['//evil.example']])(
    'leaves the callback alone for %o',
    (redirect) => {
      expect(desktopAuthCallbackUrl('rox:///login', redirect)).toBe(
        'rox:///login'
      );
    }
  );
});

describe('readRedirectParam', () => {
  it('passes a decoded redirect through', () => {
    expect(readRedirectParam('/team-invite?id=abc')).toBe(
      '/team-invite?id=abc'
    );
  });

  it('decodes a redirect that arrives still encoded', () => {
    expect(readRedirectParam('%2Fteam-invite%3Fid%3Dabc')).toBe(
      '/team-invite?id=abc'
    );
  });

  it('drops a malformed encoding', () => {
    expect(readRedirectParam('%2F%E0%A4%A')).toBeUndefined();
  });
});
