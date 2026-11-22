import { publicDomain } from '@core/constant/brand';
import { isPublicDomainHost } from './siteHost';

const LOGIN_COOKIE_AGE = 2592000; // 1 month in seconds

type CookieOptions = {
  expires?: Date;
  maxAge?: number;
  path?: string;
  sameSite?: string;
  domain?: string;
};

type LoginCookieOptions = {
  value: 'true' | 'false';
  expires: Date;
  maxAge: number;
  path: '/';
  sameSite: 'Lax';
  domain?: string;
};

const LOGIN_STORAGE_KEY = 'macro:login';

/** Check if the user appears to be authenticated based on the login cookie or localStorage fallback. */
export function hasLoginCookie(): boolean {
  if (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(LOGIN_STORAGE_KEY) === 'true'
  ) {
    return true;
  }
  if (typeof document === 'undefined') return false;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'login' && value === 'true') {
      return true;
    }
  }
  return false;
}

/** Sync the login state to localStorage for environments where cookies don't persist, e.g. Tauri. */
export function syncLoginStorage(isAuthenticated: boolean) {
  if (typeof localStorage === 'undefined') return;
  if (isAuthenticated) {
    localStorage.setItem(LOGIN_STORAGE_KEY, 'true');
  } else {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
  }
}

/** Compute login cookie options from auth state. */
export function getLoginCookieOptions(
  isAuthenticated: boolean
): LoginCookieOptions {
  // The hint travels with the session: every public-site host sees the same
  // auth cookies, so a host-only hint would hide a live session from a sibling
  // host (sign in on app.rox.one, open my.rox.one, see the signed-out screen).
  const domain = isPublicDomainHost() ? publicDomain : undefined;
  if (isAuthenticated) {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);
    return {
      value: 'true',
      expires,
      maxAge: LOGIN_COOKIE_AGE,
      path: '/',
      sameSite: 'Lax',
      domain,
    };
  }
  return {
    value: 'false',
    expires: new Date(0),
    maxAge: 0,
    path: '/',
    sameSite: 'Lax',
    domain,
  };
}

/**
 * Write the sign-in hint. Signing out also expires the host-only hint older
 * builds left behind, which would otherwise keep claiming a session on this
 * host after the shared one is gone.
 */
export function writeLoginHint(isAuthenticated: boolean) {
  const { value, ...options } = getLoginCookieOptions(isAuthenticated);
  updateCookie('login', value, options);
  if (!isAuthenticated && options.domain) {
    updateCookie('login', value, { ...options, domain: undefined });
  }
}

export function updateCookie(
  name: string,
  value: string,
  options: CookieOptions
) {
  let newCookie = `${name}=${value}`;

  if (options.expires) {
    newCookie += `; expires=${options.expires.toUTCString()}`;
  }
  if (typeof options.maxAge !== 'undefined') {
    newCookie += `; max-age=${options.maxAge}`;
  }
  if (options.path) {
    newCookie += `; path=${options.path}`;
  }
  if (options.domain) {
    newCookie += `; domain=${options.domain}`;
  }
  if (options.sameSite) {
    newCookie += `; SameSite=${options.sameSite}`;
  }

  document.cookie = newCookie;
}

/** Set a site-wide cookie that expires after `days`. */
export function setCookie(name: string, value: string, days: number) {
  const expires = days
    ? `; expires=${new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()}`
    : '';
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
}
