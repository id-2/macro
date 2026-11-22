import { publicDomain } from '@core/constant/brand';

/**
 * Whether the page is served from the public site. Every host there shares one
 * auth session: the auth service writes its cookies on `<public domain>`, so a
 * sign-in on app.rox.one is valid on my.rox.one, on preview hosts and on
 * dev.rox.one. Anything else — a local stack behind a `*.localhost` alias, the
 * desktop shell's own container — keeps a session of its own.
 */
export function isPublicDomainHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return hostname === publicDomain || hostname.endsWith(`.${publicDomain}`);
}

/**
 * Whether the page is the desktop shell's own bundle container. Its session
 * lives in the shell's native HTTP jar, not in `document.cookie`, so the page
 * cannot see a login marker; the only way to learn who is signed in is to ask
 * the auth service through that jar.
 */
export function isDesktopShellOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, protocol } = window.location;
  return protocol === 'tauri:' || hostname === 'tauri.localhost';
}
