import { describe, expect, it, vi } from 'vitest';
import {
  parseRoxAppUrl,
  parsePastedGithubPrUrl,
  resolvePastedRoxAppUrl,
} from './textPastePlugin';

// Keep the parser tests independent of application boot and editor UI wiring.
vi.mock('@core/internal/BlockLoader', () => ({}));
vi.mock('../../utils', () => ({}));
vi.mock('../mentions', () => ({}));
vi.mock('@queries/storage/pr-mention', () => ({}));

const sessionId = '019507e8-14a3-7bc1-8610-419f16bd03a8';

describe('parseRoxAppUrl', () => {
  it.each(['agents', 'agent'])(
    'recognizes %s session links as agent mentions',
    (route) => {
      expect(
        parseRoxAppUrl(
          `https://dev.rox.one/app/${route}/${sessionId}?message=target&referral_code=ignored`
        )
      ).toEqual({
        isValid: true,
        id: sessionId,
        block: 'agent',
        params: { message: 'target' },
      });
    }
  );

  it.each(['md', 'channel', 'task', 'pr', 'initiative', 'pipeline'])(
    'preserves existing %s links',
    (block) => {
      expect(
        parseRoxAppUrl(`https://dev.rox.one/app/${block}/${sessionId}`)
      ).toEqual({ isValid: true, id: sessionId, block, params: {} });
    }
  );

  it('does not treat a legacy first pane as a complete legacy link', () => {
    expect(
      parseRoxAppUrl(
        `https://dev.rox.one/app/md/${sessionId}/~/drive/pdf/${sessionId}`
      ).isValid
    ).toBe(false);
  });

  it.each([
    'https://dev.rox.one/app/agents',
    'https://dev.rox.one/app/agents/not-a-uuid',
    `https://example.com/app/agents/${sessionId}`,
    `https://dev.rox.one/app/unknown-route/${sessionId}`,
  ])('does not convert invalid or foreign links: %s', (url) => {
    expect(parseRoxAppUrl(url).isValid).toBe(false);
  });
});

describe('route-aware paste resolver', () => {
  const resolveAppLink = vi.fn(() => ({
    id: sessionId,
    block: 'md' as const,
    params: {},
  }));

  it('uses the app resolver for routed links', () => {
    const url = `https://dev.rox.one/app/drive/md/${sessionId}`;
    expect(resolvePastedRoxAppUrl(url, resolveAppLink)).toEqual({
      id: sessionId,
      block: 'md',
      params: {},
    });
    expect(resolveAppLink).toHaveBeenCalledWith(url);
  });

  it('preserves legacy query parameters without consulting the app resolver', () => {
    resolveAppLink.mockClear();
    expect(
      resolvePastedRoxAppUrl(
        `https://dev.rox.one/app/md/${sessionId}?comment_id=target`,
        resolveAppLink
      )
    ).toEqual({
      isValid: true,
      id: sessionId,
      block: 'md',
      params: { comment_id: 'target' },
    });
    expect(resolveAppLink).not.toHaveBeenCalled();
  });

  it.each([
    ['call', 'call'],
    ['pr', 'pr'],
    ['agents', 'agent'],
  ])(
    'keeps legacy /app/%s links ahead of the route resolver',
    (route, block) => {
      resolveAppLink.mockClear();
      expect(
        resolvePastedRoxAppUrl(
          `https://dev.rox.one/app/${route}/${sessionId}`,
          resolveAppLink
        )
      ).toEqual({ isValid: true, id: sessionId, block, params: {} });
      expect(resolveAppLink).not.toHaveBeenCalled();
    }
  );

  it('delegates a copied layout with a legacy first pane to the route resolver', () => {
    const url = `https://dev.rox.one/app/md/${sessionId}/~/drive/pdf/${sessionId}`;
    const resolveLayout = vi.fn(() => ({
      id: sessionId,
      block: 'pdf' as const,
      params: {},
    }));
    expect(resolvePastedRoxAppUrl(url, resolveLayout)).toEqual({
      id: sessionId,
      block: 'pdf',
      params: {},
    });
    expect(resolveLayout).toHaveBeenCalledWith(url);
  });

  it('leaves unknown links unconverted without an app resolver', () => {
    expect(
      resolvePastedRoxAppUrl(
        `https://dev.rox.one/app/drive/md/${sessionId}`
      )
    ).toBeUndefined();
  });
});

describe('parsePastedGithubPrUrl', () => {
  it.each([
    'https://github.com/rox-inc/rox/pull/7870',
    'https://www.github.com/rox-inc/rox/pull/7870',
    '  https://github.com/rox-inc/rox/pull/7870\n',
    'https://github.com/rox-inc/rox/pull/7870/files',
    'https://github.com/rox-inc/rox/pull/7870/files?w=1#diff-abc',
    'http://github.com/rox-inc/rox/pull/7870',
  ])('recognizes %s', (url) => {
    expect(parsePastedGithubPrUrl(url)).toEqual({
      owner: 'rox-inc',
      repo: 'rox',
      number: 7870,
    });
  });

  it.each([
    'https://github.com/rox-inc/rox/issues/7870',
    'https://github.com/rox-inc/rox/pull/',
    'https://github.com/rox-inc/rox/pull/0',
    'https://github.com/rox-inc/rox/pull/7870abc',
    'https://github.example.com/rox-inc/rox/pull/7870',
    'https://gist.github.com/rox-inc/rox/pull/7870',
    'see https://github.com/rox-inc/rox/pull/7870',
    'https://github.com/rox-inc/rox/pull/7870 and more',
    'github.com/rox-inc/rox/pull/7870',
  ])('ignores %s', (text) => {
    expect(parsePastedGithubPrUrl(text)).toBeNull();
  });
});
