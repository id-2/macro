import { describe, expect, it } from 'vitest';
import {
  defaultBranchFor,
  filterBranches,
  filterRepositories,
  orderBranches,
  orderRepositories,
  parseRepositoryInput,
  type ReachableRepository,
  repositoryLabel,
  repositoryShortName,
} from './repository';

describe('parseRepositoryInput', () => {
  it('canonicalizes every way of naming a GitHub repository', () => {
    const expected = 'https://github.com/rox-inc/rox';
    expect(parseRepositoryInput('rox-inc/rox')).toBe(expected);
    expect(parseRepositoryInput(' github.com/rox-inc/rox ')).toBe(expected);
    expect(parseRepositoryInput('https://github.com/rox-inc/rox.git')).toBe(
      expected
    );
    expect(parseRepositoryInput('https://github.com/rox-inc/rox/')).toBe(
      expected
    );
    expect(
      parseRepositoryInput('https://github.com/rox-inc/rox/pull/12')
    ).toBe(expected);
    expect(parseRepositoryInput('git@github.com:rox-inc/rox.git')).toBe(
      expected
    );
  });

  it('keeps other hosts as typed, minus the .git suffix', () => {
    expect(parseRepositoryInput('https://gitlab.com/group/project.git')).toBe(
      'https://gitlab.com/group/project'
    );
  });

  it('rejects text that is not a repository', () => {
    expect(parseRepositoryInput('')).toBeUndefined();
    expect(parseRepositoryInput('rox')).toBeUndefined();
    expect(parseRepositoryInput('https://example.com')).toBeUndefined();
    expect(parseRepositoryInput('not a repo')).toBeUndefined();
  });
});

describe('repository names', () => {
  it('shows owner/repo and the bare name', () => {
    expect(repositoryLabel('https://github.com/rox-inc/rox')).toBe(
      'rox-inc/rox'
    );
    expect(repositoryShortName('https://github.com/rox-inc/rox')).toBe(
      'rox'
    );
    expect(repositoryLabel('https://gitlab.com/group/project.git')).toBe(
      'group/project'
    );
  });
});

const rox: ReachableRepository = {
  url: 'https://github.com/rox-inc/rox',
  defaultBranch: 'main',
};
const infra: ReachableRepository = {
  url: 'https://github.com/rox-inc/infra',
  defaultBranch: 'develop',
};
const scratch: ReachableRepository = {
  url: 'https://github.com/rox-inc/scratch',
};

describe('orderRepositories', () => {
  it('puts recents first, in their order, then the rest as listed', () => {
    expect(orderRepositories([infra, rox, scratch], [scratch.url])).toEqual([
      scratch,
      infra,
      rox,
    ]);
  });

  it('omits a recent the listing no longer carries, and dedupes by spelling', () => {
    expect(
      orderRepositories(
        [rox],
        [
          'https://github.com/rox-inc/gone',
          'https://github.com/ROX-INC/GONE',
        ]
      )
    ).toEqual([rox]);
  });
});

describe('filterRepositories', () => {
  it('matches the owner/repo label and the url, ignoring case', () => {
    const all = [rox, infra, scratch];
    expect(filterRepositories(all, '')).toEqual(all);
    expect(filterRepositories(all, 'INFRA')).toEqual([infra]);
    expect(filterRepositories(all, 'rox-inc/s')).toEqual([scratch]);
    expect(filterRepositories(all, 'github.com/rox-inc/rox')).toEqual([
      rox,
    ]);
    expect(filterRepositories(all, 'nothing')).toEqual([]);
  });
});

describe('defaultBranchFor', () => {
  it("starts on the repository's default branch, or main without one", () => {
    const all = [rox, infra, scratch];
    expect(defaultBranchFor(all, infra.url)).toBe('develop');
    expect(defaultBranchFor(all, 'https://github.com/rox-inc/infra')).toBe(
      'develop'
    );
    expect(defaultBranchFor(all, scratch.url)).toBe('main');
    expect(defaultBranchFor(all, 'https://github.com/rox-inc/unlisted')).toBe(
      'main'
    );
    expect(defaultBranchFor(all, undefined)).toBe('main');
  });
});

describe('orderBranches', () => {
  it("puts the repository's default first when it is listed", () => {
    expect(orderBranches(['feature/a', 'main', 'develop'], 'main')).toEqual([
      'main',
      'feature/a',
      'develop',
    ]);
  });

  it('leaves GitHub order alone when the default is unknown or absent', () => {
    expect(orderBranches(['feature/a', 'develop'], 'main')).toEqual([
      'feature/a',
      'develop',
    ]);
    expect(orderBranches(['feature/a', 'develop'])).toEqual([
      'feature/a',
      'develop',
    ]);
  });
});

describe('filterBranches', () => {
  it('matches a branch name, ignoring case', () => {
    const all = ['main', 'develop', 'feature/Home'];
    expect(filterBranches(all, '')).toEqual(all);
    expect(filterBranches(all, 'DEV')).toEqual(['develop']);
    expect(filterBranches(all, 'home')).toEqual(['feature/Home']);
    expect(filterBranches(all, 'nothing')).toEqual([]);
  });
});
