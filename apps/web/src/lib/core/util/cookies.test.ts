import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getLoginCookieOptions, writeLoginHint } from './cookies';

let writes: string[] = [];

beforeEach(() => {
  writes = [];
  const document = {} as Document;
  Object.defineProperty(document, 'cookie', {
    get: () => '',
    set: (value: string) => {
      writes.push(value);
    },
  });
  vi.stubGlobal('document', document);
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      location: new URL('https://my.rox.one/app'),
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

it('writes the login hint on the public domain so sibling hosts see it', () => {
  expect(getLoginCookieOptions(true).domain).toBe('rox.one');
  writeLoginHint(true);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain('login=true');
  expect(writes[0]).toContain('domain=rox.one');
});

it('keeps the hint host-only where hosts are separate sessions', () => {
  window.location.hostname = 'alice.localhost';
  expect(getLoginCookieOptions(true).domain).toBeUndefined();
  writeLoginHint(true);
  expect(writes[0]).not.toContain('domain=');
});

it('expires both the shared hint and a host-only leftover on sign-out', () => {
  writeLoginHint(false);
  expect(writes).toHaveLength(2);
  for (const write of writes) {
    expect(write).toContain('login=false');
    expect(write).toContain('max-age=0');
  }
  expect(writes[0]).toContain('domain=rox.one');
  expect(writes[1]).not.toContain('domain=');
});
