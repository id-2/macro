import { isTauri } from '@core/util/platform';
import { invoke } from '@tauri-apps/api/core';

let inFlight: Promise<void> | null = null;

/**
 * Drops the stale twin of every session cookie in the desktop shell's jar.
 *
 * A cookie name can sit in the jar twice — host-only and domain-wide — after a
 * sign-in that changed the server's cookie scope. Requests then carry two
 * access tokens, and the services read the last one, so the answer depends on
 * jar order: an expired or other-login token surfaces as `Unauthorized access`
 * on endpoints that would otherwise work. The shell prunes the older twin, and
 * its value never leaves the native layer. A web page has no such jar; nothing
 * happens outside the desktop app.
 */
export function pruneDesktopSessionCookies(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  if (inFlight) return inFlight;
  const run = invoke<number>('prune_session_cookies')
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      if (inFlight === run) inFlight = null;
    });
  inFlight = run;
  return run;
}
