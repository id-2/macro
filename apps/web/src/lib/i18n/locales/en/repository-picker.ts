/** The repository and branch pickers shared by the composer and Home. */
export default {
  repository: 'Repository',
  repositories: 'Repositories',
  searchRepositories: 'Search repositories',
  searchRepositoriesPlaceholder: 'Search, or paste owner/repo',
  repositoriesLoadFailed: "Couldn't load your repositories.",
  repositoriesLoading: 'Loading your repositories…',
  noRepositories:
    "No repositories yet. Give Rox's GitHub App access to the repositories your coders should work on.",
  noMatches: 'No repositories match “{{query}}”.',
  invalidRepository:
    'Enter a GitHub repository as owner/repo or a repository URL.',
  startingBranch: 'Starting branch',
  branch: 'Branch',
  branchLockedHint: 'New local sessions start from main',
  searchBranches: 'Search branches',
  searchBranchesPlaceholder: 'Search, or type a branch name',
  branches: 'Branches',
  useBranch: 'Use {{name}}',
  defaultBranch: '(default)',
  branchesLoadFailed: "Couldn't load this repository's branches.",
  branchesLoading: 'Loading branches…',
  noBranches: 'No branches yet. Type a starting branch to use.',
  noBranchMatches: 'No branches match “{{query}}”.',
  invalidBranch:
    'Enter a valid branch name, for example main or feature/my-change.',
};
