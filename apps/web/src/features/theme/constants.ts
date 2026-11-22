import { DEFAULT_THEMES } from './themes';

type DefaultTheme = (typeof DEFAULT_THEMES)[number]['id'];

export const DEFAULT_LIGHT_THEME: DefaultTheme = 'Lapis';
export const DEFAULT_DARK_THEME: DefaultTheme = 'Rox Dark';

/** Previous built-in ids. A saved copy of either means the person never picked a theme. */
export const LEGACY_UNSET_THEME_IDS = ['Rox Dark', 'Rox Light'] as const;

export function isLegacyUnsetTheme(id: string): boolean {
  return (LEGACY_UNSET_THEME_IDS as readonly string[]).includes(id);
}

export { DEFAULT_THEMES };
