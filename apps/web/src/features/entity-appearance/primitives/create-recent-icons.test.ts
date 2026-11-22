import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { createRecentIcons } from './create-recent-icons';

afterEach(() => localStorage.clear());

describe('recent icon preferences', () => {
  it('bounds, deduplicates, and persists picks without sharing accounts', () => {
    const first = createRoot((dispose) => ({
      dispose,
      recent: createRecentIcons('first'),
    }));
    for (const name of [
      'star',
      'flag',
      'heart',
      'calendar-blank',
      'file',
      'book-open',
      'database',
      'code',
      'bug',
      'cpu',
    ]) {
      first.recent.record({ kind: 'rox', name });
    }
    first.recent.record({ kind: 'rox', name: 'file' });
    expect(first.recent.icons()).toHaveLength(9);
    expect(first.recent.icons()[0]).toEqual({ kind: 'rox', name: 'file' });
    expect(
      first.recent
        .icons()
        .filter((icon) => icon.kind === 'rox' && icon.name === 'file')
    ).toHaveLength(1);
    const second = createRoot((dispose) => ({
      dispose,
      recent: createRecentIcons('second'),
    }));
    expect(second.recent.icons()).toEqual([]);
    const restored = createRoot((dispose) => ({
      dispose,
      recent: createRecentIcons('first'),
    }));
    expect(restored.recent.icons()).toEqual(first.recent.icons());
    first.dispose();
    second.dispose();
    restored.dispose();
  });

  it('ignores malformed, retired, and unknown picks when reading and recording', () => {
    localStorage.setItem(
      'entity-icons:recent:first',
      JSON.stringify([
        null,
        { kind: 'rox', name: 'align-bottom-simple' },
        { kind: 'rox', name: 'calendar-dots' },
        { kind: 'rox', name: 'unknown-icon' },
        { kind: 'rox', name: 'star' },
        { kind: 'emoji', value: '🚀' },
        { kind: 'emoji', value: 42 },
      ])
    );
    const { recent, dispose } = createRoot((dispose) => ({
      dispose,
      recent: createRecentIcons('first'),
    }));
    recent.record({ kind: 'rox', name: 'calendar-dots' });
    recent.record({ kind: 'rox', name: 'unknown-icon' });
    expect(recent.icons()).toEqual([
      { kind: 'rox', name: 'star' },
      { kind: 'emoji', value: '🚀' },
    ]);
    dispose();
  });
});
