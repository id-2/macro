import { afterEach, describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createManifest, isNewer, releaseIdentity, updateFeedEnabled } from './desktop-release.mjs';

const script = fileURLToPath(new URL('./desktop-release.mjs', import.meta.url));
const repository = 'rox-one/rox-one';
const ARTIFACTS = [
  ['darwin-aarch64', 'aarch64-darwin.app.tar.gz'],
  ['linux-x86_64', 'x86_64-linux.AppImage'],
] as const;

interface ReleaseIdentity {
  tag: string;
  version: string;
  nativeBuild: number;
}

function writeRelease(directory: string, identity: ReleaseIdentity, enabled: boolean) {
  for (const [target, suffix] of ARTIFACTS) {
    const name = `Rox-${identity.version}-${suffix}`;
    writeFileSync(join(directory, name), 'artifact');
    writeFileSync(join(directory, `${name}.sig`), 'signature');
    writeFileSync(join(directory, `${target}.release.json`), JSON.stringify({ ...identity, enabled }));
  }
}

function runManifest(directory: string, tag: string) {
  return spawnSync(process.execPath, [script, 'manifest', directory, tag, repository], { encoding: 'utf8' });
}

describe('desktop releases', () => {
  test('maps calendar tags without losing revision ordering', () => {
    expect(releaseIdentity('refs/tags/v2026.10.6.12')).toEqual({
      tag: 'v2026.10.6.12', version: '2026.1006.12', nativeBuild: 202610060012,
    });
    expect(isNewer('2026.1006.12', '2026.1006.9')).toBe(true);
    expect(isNewer('2026.1007.0', '2026.1006.9999')).toBe(true);
    expect(isNewer('2026.1006.12', '2026.1006.12')).toBe(false);
    expect(isNewer('2.5.0', '2026.1006.12')).toBe(false);
  });

  test('rejects malformed tags and impossible dates', () => {
    for (const tag of ['v2026.2.30.1', 'v2026.13.1.1', 'v1.2.3-beta', 'main', 'v1.2.10000', 'v0.0.0']) {
      expect(() => releaseIdentity(tag)).toThrow();
    }
  });

  test('points the checked-in updater at the product repository', () => {
    const config = JSON.parse(readFileSync(new URL('../tauri/desktop-release.json', import.meta.url), 'utf8'));
    expect(config.endpoint).toBe('https://github.com/rox-one/rox-one/releases/download/desktop-stable/latest.json');
    expect(config.publicKey).not.toBe('');
  });

  const directories: string[] = [];
  afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true }); });

  const releaseDirectory = (identity: ReleaseIdentity, enabled: boolean) => {
    const dir = mkdtempSync(join(tmpdir(), 'rox-desktop-release-'));
    directories.push(dir);
    writeRelease(dir, identity, enabled);
    return dir;
  };

  test('requires both signed platform artifacts with the packaged version', () => {
    const tag = 'v2026.10.6.1';
    const identity = releaseIdentity(tag);
    const dir = releaseDirectory(identity, true);
    const manifest = createManifest(dir, tag, repository);
    expect(Object.keys(manifest.platforms)).toEqual(['darwin-aarch64', 'linux-x86_64']);
    expect(manifest.platforms['darwin-aarch64'].url).toContain('/v2026.10.6.1/Rox-2026.1006.1-');
    rmSync(join(dir, 'Rox-2026.1006.1-x86_64-linux.AppImage.sig'));
    expect(() => createManifest(dir, tag, repository)).toThrow();
  });

  test('describes a release with the updater flag off without publishing the feed', () => {
    const tag = 'v2026.10.6.1';
    const identity = releaseIdentity(tag);
    const dir = releaseDirectory(identity, false);
    expect(updateFeedEnabled(dir)).toBe(false);
    expect(createManifest(dir, tag, repository).notes).toBe(`Rox ${tag}`);
    const result = runManifest(dir, tag);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).platforms['linux-x86_64'].url).toContain(`/${repository}/releases/download/`);
    // The publisher uploads latest.json, so its absence keeps the channel closed.
    expect(existsSync(join(dir, 'latest.json'))).toBe(false);
  });

  test('writes the feed only after the updater flag is enabled', () => {
    const tag = 'v2026.10.6.1';
    const identity = releaseIdentity(tag);
    const dir = releaseDirectory(identity, true);
    expect(updateFeedEnabled(dir)).toBe(true);
    const result = runManifest(dir, tag);
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8')).version).toBe(identity.version);
  });
});
