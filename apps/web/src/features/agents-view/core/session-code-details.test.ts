import { describe, expect, it } from 'vitest';
import { repositoryLabel } from './session-code-details';

describe('repositoryLabel', () => {
  it.each([
    ['https://github.com/rox-inc/rox', 'rox-inc/rox'],
    ['https://github.com/rox-inc/rox.git/', 'rox-inc/rox'],
    ['git@github.com:rox-inc/rox.git', 'rox-inc/rox'],
    ['ssh://git@github.com/rox-inc/rox.git', 'rox-inc/rox'],
    [
      'https://token@github.com/rox-inc/rox.git?key=private',
      'rox-inc/rox',
    ],
    ['', undefined],
    ['not a repository URL', undefined],
    [null, undefined],
  ])('formats %s without credentials or transport details', (url, expected) => {
    expect(repositoryLabel(url)).toBe(expected);
  });
});
