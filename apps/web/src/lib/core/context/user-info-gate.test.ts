import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const hasLoginCookie = vi.hoisted(() => vi.fn(() => false));
vi.mock('@core/util/cookies', () => ({ hasLoginCookie }));

// The gate reads the location once, at module load, so each case stubs the
// window first and then imports a fresh copy — a static import would evaluate
// before the stub exists.

beforeEach(() => {
  vi.resetModules();
  hasLoginCookie.mockReturnValue(false);
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      location: new URL('https://app.rox.one/app'),
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

it.each([
  'rox.one',
  'app.rox.one',
  'my.rox.one',
  'dev.rox.one',
  'branch-abc123.preview.rox.one',
])(
  'checks the shared session on %s without a local login marker',
  async (hostname) => {
    window.location.hostname = hostname;
    const { shouldQueryUserInfo } = await import('./user-info-gate');
    expect(shouldQueryUserInfo()).toBe(true);
  }
);

it.each([
  'localhost',
  'alice.localhost',
  'branch.preview.rox.one.example.com',
])('keeps anonymous identity checks disabled on %s', async (hostname) => {
  window.location.hostname = hostname;
  const { shouldQueryUserInfo } = await import('./user-info-gate');
  expect(shouldQueryUserInfo()).toBe(false);
});

it('checks identity from the desktop shell, whose session the page cannot see', async () => {
  window.location.hostname = 'tauri.localhost';
  const { shouldQueryUserInfo } = await import('./user-info-gate');
  // The shell signs in through a native cookie jar; document.cookie is empty
  // even for a signed-in app, so the auth service must be asked.
  expect(hasLoginCookie()).toBe(false);
  expect(shouldQueryUserInfo()).toBe(true);
});

it('checks identity with an existing login marker', async () => {
  window.location.hostname = 'localhost';
  hasLoginCookie.mockReturnValue(true);
  const { shouldQueryUserInfo } = await import('./user-info-gate');
  expect(shouldQueryUserInfo()).toBe(true);
});

it('wakes an anonymous identity observer when another tab publishes a login marker', async () => {
  window.location.hostname = 'localhost';
  const { shouldQueryUserInfo } = await import('./user-info-gate');
  expect(shouldQueryUserInfo()).toBe(false);
  window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
  expect(shouldQueryUserInfo()).toBe(false);

  hasLoginCookie.mockReturnValue(true);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'macro:login',
      newValue: 'true',
    })
  );
  expect(shouldQueryUserInfo()).toBe(true);
});
