import { queryOptions, useQuery } from '@tanstack/solid-query';
import { getRoxGithubStars } from '../service-clients/service-github-public/client';

const githubStarsQueryOptions = queryOptions({
  queryKey: ['public', 'github', 'rox-inc/rox', 'stars'],
  queryFn: ({ signal }) => getRoxGithubStars(signal),
  staleTime: 60 * 60 * 1000,
  gcTime: 24 * 60 * 60 * 1000,
  retry: 1,
  throwOnError: false,
});

/** Shared across onboarding mounts; this public request needs no sign-in. */
export function useGithubStarsQuery() {
  return useQuery(() => githubStarsQueryOptions);
}
