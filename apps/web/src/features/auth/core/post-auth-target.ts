import { sanitizeNext } from '@app/features/onboarding/core/next-target';

export const AGENT_SETUP_PATH = '/agent-setup';

/** Where a freshly signed-in user goes. */
export type PostAuthTarget = { t: 'navigate'; to: string };

/**
 * Resolves the page a sign-in lands on. Every account takes the same rule: an
 * agent with no token yet goes to setup, everyone else goes to the page they
 * asked for (an invite, a meeting) or into the app.
 *
 * Onboarding is not part of this decision. It used to send first-time accounts
 * to `/welcome` and existing ones to Home, so the same product had two entry
 * rules and the owner could not see what a new person saw. A new account now
 * enters the app exactly like the owner's does, and the onboarding flow is a
 * page anyone opens deliberately (`/onboarding`).
 */
export function postAuthTarget(input: {
  tutorialComplete: boolean;
  isAgent: boolean;
  redirect: unknown;
}): PostAuthTarget {
  if (input.isAgent && !input.tutorialComplete) {
    return { t: 'navigate', to: AGENT_SETUP_PATH };
  }
  return { t: 'navigate', to: sanitizeNext(input.redirect) ?? '/' };
}

/**
 * The desktop sign-in callback, carrying the page's `redirect`. Desktop SSO
 * returns through a pinned `rox:///login` deep link rather than the page
 * sign-in started on, so the deep link would otherwise be lost; the auth
 * service keeps the query and appends the session code.
 *
 * The auth service URL-decodes `original_url` once more after reading it from
 * the query (`UrlEncoded<Url>`), so the redirect is encoded twice here: a
 * redirect with its own `&` would otherwise split into separate parameters.
 * {@link readRedirectParam} accepts it whether or not that extra decode runs.
 */
export function desktopAuthCallbackUrl(
  callbackUrl: string,
  redirect: unknown
): string {
  const next = sanitizeNext(redirect);
  if (!next) return callbackUrl;
  return `${callbackUrl}?redirect=${encodeURIComponent(encodeURIComponent(next))}`;
}

/**
 * The login page's `redirect` parameter, decoded once more when it arrives
 * still encoded (a desktop callback the auth service did not decode twice).
 */
export function readRedirectParam(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('%2F')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
