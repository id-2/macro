import { makePersisted } from '@solid-primitives/storage';
import { createMemo, createSignal } from 'solid-js';
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEMES,
  isLegacyUnsetTheme,
} from '../constants';
import type {
  ThemeColorTokens,
  ThemeV0,
  ThemeV1,
  ThemeV3,
} from '../types/themeTypes';
import { resolveThemeColors } from '../utils/resolvedThemeColors';
import { normalizeThemeColorTokens } from '../utils/themeColorTokens';
import {
  convertThemev0v1,
  convertThemev1v2,
  convertThemev2v3,
} from '../utils/themeMigrations';
import { isThemeV2, isThemeV3 } from '../utils/themeValidation';

export const [isThemeSaved, setIsThemeSaved] = createSignal<boolean>(true);

/** Resolved semantic colors used by index.html before the app loads. */
export const [htmlColor, setHtmlColor] = makePersisted(
  createSignal<{
    color: string;
    panel?: string;
    ink?: string;
    muted?: string;
    input?: string;
  }>({ color: '' }),
  { name: 'html-color-theme-v2' }
);

export const [userThemes, setUserThemes] = makePersisted(
  createSignal<ThemeV3[]>([]),
  { name: 'macro-user-themes' }
);
setUserThemes(
  (userThemes() as unknown[]).flatMap((theme) => {
    if (isThemeV3(theme)) {
      return [
        {
          ...theme,
          colorTokens: normalizeThemeColorTokens(theme.colorTokens, theme.mode),
        },
      ];
    }
    if (isThemeV2(theme)) return [convertThemev2v3(theme)];
    if (typeof theme !== 'object' || theme === null) return [];

    const version = (theme as { version?: unknown }).version;
    if (version === 1) {
      return [convertThemev2v3(convertThemev1v2(theme as ThemeV1))];
    }
    if (version === undefined || version === 0) {
      return [
        convertThemev2v3(convertThemev1v2(convertThemev0v1(theme as ThemeV0))),
      ];
    }
    return [];
  })
);

export const [currentThemeId, setCurrentThemeId] = makePersisted(
  createSignal<string>(DEFAULT_LIGHT_THEME),
  { name: 'macro-selected-theme-v2' }
);

export const themes = createMemo<ThemeV3[]>(() => [
  ...DEFAULT_THEMES,
  ...userThemes(),
]);

/** VNext colors currently rendered and edited in the document. */
export const [themeColorTokens, setThemeColorTokens] =
  createSignal<ThemeColorTokens>({});

/** Intrinsic mode of the currently rendered theme. */
export const [liveThemeMode, setLiveThemeMode] = createSignal<'light' | 'dark'>(
  'light'
);

/** Shared concrete colors for integrations which cannot inherit CSS tokens. */
export const resolvedThemeColors = createMemo(() =>
  resolveThemeColors(themeColorTokens(), liveThemeMode())
);

/** Icons outside the app follow committed colors, not transient previews. */
export const [committedThemeAccent, setCommittedThemeAccent] = createSignal(
  'oklch(0.7 0.12 250deg)'
);

// Per-mode theme preferences, persisted to localStorage. The active one is
// applied by systemThemeEffect / resolveActiveThemeId (themeUtils.ts): the light
// theme when themeMode is 'light' (or 'system' + OS light), the dark theme when
// 'dark' (or 'system' + OS dark).
export const [lightModeTheme, setLightModeTheme] = makePersisted(
  createSignal<string>(DEFAULT_LIGHT_THEME),
  { name: 'macro-light-mode-theme' }
);

export const [darkModeTheme, setDarkModeTheme] = makePersisted(
  createSignal<string>(DEFAULT_DARK_THEME),
  { name: 'macro-dark-mode-theme' }
);

/** The "Active theme" mode: pin a fixed light or dark theme, or follow the OS
 *  ('system'). Drives which per-mode theme (lightModeTheme/darkModeTheme) is
 *  live — see resolveActiveThemeId / systemThemeEffect in themeUtils. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Fallback for the initial themeMode, migrating the pre-"Active theme" setting
 *  (`macro-theme-should-match-system`). Someone who has not picked a theme
 *  opens in light Lapis. An explicit system match, or a pinned non-default
 *  theme, is kept. Only used until `macro-theme-mode` is written. */
function initialThemeMode(): ThemeMode {
  if (typeof localStorage === 'undefined') {
    return 'light';
  }
  const legacy = localStorage.getItem('macro-theme-should-match-system');
  if (legacy === 'true') {
    return 'system';
  }
  if (legacy === 'false') {
    const pinned = themes().find((theme) => theme.id === currentThemeId());
    if (!pinned || isLegacyUnsetTheme(pinned.id)) {
      return 'light';
    }
    return pinned.mode;
  }
  return 'light';
}

export const [themeMode, setThemeMode] = makePersisted(
  createSignal<ThemeMode>(initialThemeMode()),
  { name: 'macro-theme-mode' }
);

const supportsMatchMedia =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

// Tracks the OS color scheme so the active theme can follow it when themeMode is
// 'system'.
export const [systemMode, setSystemMode] = createSignal<'dark' | 'light'>(
  supportsMatchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
);

if (supportsMatchMedia) {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    setSystemMode(e.matches ? 'dark' : 'light');
  });
}

// Theme-list filters: whether light and/or dark themes are shown in the list.
export const [showLightThemes, setShowLightThemes] = makePersisted(
  createSignal<boolean>(true),
  { name: 'macro-show-light-themes' }
);
export const [showDarkThemes, setShowDarkThemes] = makePersisted(
  createSignal<boolean>(true),
  { name: 'macro-show-dark-themes' }
);

export const [themeDepth, setThemeDepth] = createSignal<number>(0.15);

function readStoredThemeId(name: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(name);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return raw;
  }
}

function openingThemeId(): string {
  const resolved = themeMode() === 'system' ? systemMode() : themeMode();
  return resolved === 'dark' ? darkModeTheme() : lightModeTheme();
}

/** Saved Rox Dark / Rox Light are the old defaults, not a choice. Open Lapis
 *  in light mode. A different saved theme is left alone. */
function adoptLapisWhenThemeWasUnset(): void {
  const storedSelected = readStoredThemeId('macro-selected-theme');
  const selectedUnset =
    storedSelected === null || isLegacyUnsetTheme(storedSelected);
  const opening = openingThemeId();
  const openingIsChosen =
    opening !== '' &&
    !isLegacyUnsetTheme(opening) &&
    opening !== DEFAULT_LIGHT_THEME;

  if (selectedUnset && !openingIsChosen) {
    setLightModeTheme(DEFAULT_LIGHT_THEME);
    setCurrentThemeId(DEFAULT_LIGHT_THEME);
    setThemeMode('light');
    setLiveThemeMode('light');
    return;
  }

  if (isLegacyUnsetTheme(lightModeTheme())) {
    setLightModeTheme(DEFAULT_LIGHT_THEME);
  }
  const liveId = openingThemeId();
  if (
    storedSelected !== null &&
    isLegacyUnsetTheme(storedSelected) &&
    liveId !== ''
  ) {
    setCurrentThemeId(liveId);
  }
  const live = themes().find((theme) => theme.id === liveId);
  if (live) {
    setLiveThemeMode(live.mode);
  }
}

adoptLapisWhenThemeWasUnset();
