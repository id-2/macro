import { type as osType } from '@tauri-apps/plugin-os';

type RoxPlatform = 'web' | 'desktop' | 'ios' | 'android';
type NativeMobilePlatform = Extract<RoxPlatform, 'ios' | 'android'>;

let cached: RoxPlatform | undefined;

function detectPlatform(): RoxPlatform {
  if (!isTauri()) return 'web';
  const os = osType();
  if (os === 'ios') return 'ios';
  if (os === 'android') return 'android';
  return 'desktop';
}

export function getPlatform(): RoxPlatform {
  if (cached === undefined) cached = detectPlatform();
  return cached;
}

export function isPlatform(target: RoxPlatform | RoxPlatform[]): boolean {
  const platform = getPlatform();
  return Array.isArray(target)
    ? target.includes(platform)
    : platform === target;
}

function isMobilePlatform(): boolean;
function isMobilePlatform(
  platform: RoxPlatform
): platform is NativeMobilePlatform;
function isMobilePlatform(platform: RoxPlatform = getPlatform()): boolean {
  return platform === 'ios' || platform === 'android';
}

/** Whether this is the desktop (Tauri) app on macOS/Windows/Linux. */
export function isDesktopPlatform(): boolean {
  return isPlatform('desktop');
}

export function getNativeMobilePlatform() {
  const platform = getPlatform();
  return isMobilePlatform(platform) ? platform : undefined;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
