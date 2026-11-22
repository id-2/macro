import { hasLoginCookie } from '@core/util/cookies';
import {
  isDesktopShellOrigin,
  isPublicDomainHost,
} from '@core/util/siteHost';
import { createSignal } from 'solid-js';

// Every host on the public site shares one session: the auth service writes
// its cookies on `<public domain>`, so a sign-in on app.rox.one is valid on
// my.rox.one, on preview hosts and on dev.rox.one. The login hint is per
// origin, though (localStorage is, and an older build wrote the cookie
// host-only), so such a host can hold a live session with no hint at all.
// Probe identity without one: a 401 still lands the visitor on the signed-out
// screen, while account services keep requiring confirmed authentication.
//
// The desktop shell keeps its session in a native HTTP jar that the page
// cannot read, so there is never a hint either. Asking is the only way to tell
// a signed-in app from an anonymous shell; the answer still comes from the
// session cookie the shell signs in with, never from local state.
const [shouldQueryUserInfo, setShouldQueryUserInfo] = createSignal(
  hasLoginCookie() || isPublicDomainHost() || isDesktopShellOrigin()
);

export { shouldQueryUserInfo };

export function enableUserInfoQuery() {
  setShouldQueryUserInfo(true);
}

// A login popup or sibling tab updates the shared login marker. It is only a
// hint to check identity, never proof that account services may start.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    if (hasLoginCookie()) enableUserInfoQuery();
  });
}
