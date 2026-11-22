/**
 * @vitest-environment jsdom
 */

import { err, type Ok, ok } from 'neverthrow';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const roxApiToken = vi.fn();

vi.mock('./client', () => ({
  authServiceClient: { roxApiToken },
  getExpiresAt: (token: string) => {
    try {
      const payload: unknown = JSON.parse(atob(token.split('.')[1]));
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('exp' in payload)
      ) {
        return 0;
      }

      const expValue = payload.exp;
      if (typeof expValue !== 'number' && typeof expValue !== 'string') {
        return 0;
      }

      const exp = Number(expValue) * 1000;
      return Number.isFinite(exp) ? exp : 0;
    } catch {
      return 0;
    }
  },
}));

function jwt(exp: unknown) {
  const payload = btoa(JSON.stringify({ exp }));
  return `header.${payload}.signature`;
}

describe('getMacroApiToken', () => {
  beforeEach(() => {
    vi.resetModules();
    roxApiToken.mockReset();
  });

  test('reuses an unexpired cached token', async () => {
    const token = jwt(Math.floor(Date.now() / 1000) + 3600);
    roxApiToken.mockResolvedValue(ok({ rox_api_token: token }));
    const { getMacroApiToken } = await import('./fetch');

    await expect(getMacroApiToken()).resolves.toBe(token);
    await expect(getMacroApiToken()).resolves.toBe(token);

    expect(roxApiToken).toHaveBeenCalledTimes(1);
  });

  test('refreshes an expired cached token', async () => {
    const expired = jwt(Math.floor(Date.now() / 1000) - 60);
    const fresh = jwt(Math.floor(Date.now() / 1000) + 3600);
    roxApiToken
      .mockResolvedValueOnce(ok({ rox_api_token: expired }))
      .mockResolvedValueOnce(ok({ rox_api_token: fresh }));
    const { getMacroApiToken } = await import('./fetch');

    await expect(getMacroApiToken()).resolves.toBe(expired);
    await expect(getMacroApiToken()).resolves.toBe(fresh);

    expect(roxApiToken).toHaveBeenCalledTimes(2);
  });

  test('refreshes a cached token with a non-scalar exp', async () => {
    const malformed = jwt([Math.floor(Date.now() / 1000) + 3600]);
    const fresh = jwt(Math.floor(Date.now() / 1000) + 3600);
    roxApiToken
      .mockResolvedValueOnce(ok({ rox_api_token: malformed }))
      .mockResolvedValueOnce(ok({ rox_api_token: fresh }));
    const { getMacroApiToken } = await import('./fetch');

    await expect(getMacroApiToken()).resolves.toBe(malformed);
    await expect(getMacroApiToken()).resolves.toBe(fresh);

    expect(roxApiToken).toHaveBeenCalledTimes(2);
  });

  test('deduplicates concurrent requests when the cache is empty', async () => {
    const token = jwt(Math.floor(Date.now() / 1000) + 3600);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    roxApiToken.mockImplementation(async () => {
      await gate;
      return ok({ rox_api_token: token });
    });
    const { getMacroApiToken } = await import('./fetch');

    const first = getMacroApiToken();
    const second = getMacroApiToken();

    expect(roxApiToken).toHaveBeenCalledTimes(1);
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([token, token]);
  });

  test('deduplicates concurrent refreshes of an expired cached token', async () => {
    const expired = jwt(Math.floor(Date.now() / 1000) - 60);
    const fresh = jwt(Math.floor(Date.now() / 1000) + 3600);
    roxApiToken.mockResolvedValueOnce(ok({ rox_api_token: expired }));
    const { getMacroApiToken } = await import('./fetch');

    await expect(getMacroApiToken()).resolves.toBe(expired);

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    roxApiToken.mockImplementationOnce(async () => {
      await gate;
      return ok({ rox_api_token: fresh });
    });

    const first = getMacroApiToken();
    const second = getMacroApiToken();

    await Promise.resolve();
    expect(roxApiToken).toHaveBeenCalledTimes(2);
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([fresh, fresh]);
  });

  test('replacement login discards a cached token and fences an old token request', async () => {
    const old = jwt(Math.floor(Date.now() / 1000) + 3600);
    const next = jwt(Math.floor(Date.now() / 1000) + 7200);
    const held =
      Promise.withResolvers<Ok<{ rox_api_token: string }, unknown>>();
    roxApiToken
      .mockReturnValueOnce(held.promise)
      .mockResolvedValueOnce(ok({ rox_api_token: next }));
    const { getMacroApiToken, resetMacroApiToken } = await import('./fetch');
    const obsolete = getMacroApiToken();
    const rejected = expect(obsolete).rejects.toThrow(
      'Authentication session changed'
    );
    resetMacroApiToken();
    await expect(getMacroApiToken()).resolves.toBe(next);
    held.resolve(ok({ rox_api_token: old }));
    await rejected;
    await expect(getMacroApiToken()).resolves.toBe(next);
    expect(roxApiToken).toHaveBeenCalledTimes(2);
    resetMacroApiToken();
    roxApiToken.mockResolvedValueOnce(ok({ rox_api_token: old }));
    await expect(getMacroApiToken()).resolves.toBe(old);
    expect(roxApiToken).toHaveBeenCalledTimes(3);
  });

  test('does not dispatch an authenticated request after its token generation changes', async () => {
    const held =
      Promise.withResolvers<Ok<{ rox_api_token: string }, unknown>>();
    roxApiToken.mockReturnValueOnce(held.promise);
    const nativeFetch = vi.spyOn(globalThis, 'fetch');
    const { fetchWithAuth, resetMacroApiToken } = await import('./fetch');
    const pending = fetchWithAuth('/user/get_names_with_email', {
      method: 'POST',
    });
    const rejected = expect(pending).rejects.toThrow(
      'Authentication session changed'
    );
    resetMacroApiToken();
    held.resolve(
      ok({ rox_api_token: jwt(Math.floor(Date.now() / 1000) + 3600) })
    );
    await rejected;
    expect(nativeFetch).not.toHaveBeenCalled();
    nativeFetch.mockRestore();
  });

  test('rejects an authenticated response that lands after session replacement', async () => {
    roxApiToken.mockResolvedValue(
      ok({ rox_api_token: jwt(Math.floor(Date.now() / 1000) + 3600) })
    );
    const entered = Promise.withResolvers<void>();
    const response = Promise.withResolvers<Response>();
    const nativeFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => {
        entered.resolve();
        return response.promise;
      });
    try {
      const { fetchWithAuth, resetMacroApiToken } = await import('./fetch');
      const pending = fetchWithAuth('/user/name');
      const rejected = expect(pending).rejects.toThrow(
        'Authentication session changed'
      );
      await entered.promise;
      resetMacroApiToken();
      response.resolve(
        new Response(JSON.stringify({ first_name: 'Old private name' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
      await rejected;
    } finally {
      nativeFetch.mockRestore();
    }
  });

  test('does not permanently cache a rejected token request', async () => {
    const fresh = jwt(Math.floor(Date.now() / 1000) + 3600);
    roxApiToken
      .mockResolvedValueOnce(
        err([{ code: 'UNAUTHORIZED' as const, message: 'Unauthorized access' }])
      )
      .mockResolvedValueOnce(ok({ rox_api_token: fresh }));
    const { getMacroApiToken } = await import('./fetch');

    await expect(getMacroApiToken()).rejects.toBeDefined();
    await expect(getMacroApiToken()).resolves.toBe(fresh);

    expect(roxApiToken).toHaveBeenCalledTimes(2);
  });
});
