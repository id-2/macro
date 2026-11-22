import { useAnalytics } from '@app/lib/analytics/analytics-context';
import { useCurrentTeamQuery } from '@queries/team/teams';
import { type Accessor, createEffect, createMemo } from 'solid-js';
import { createAssertedContextProvider } from './createContext';

export const ROX_TEAM_SLUG = 'MACRO';

type TeamContextValue = {
  isRoxTeam: Accessor<boolean>;
};

export const [TeamContextProvider, useTeamContext] =
  createAssertedContextProvider('TeamContext', (): TeamContextValue => {
    const analytics = useAnalytics();
    const currentTeam = useCurrentTeamQuery();
    // Guarded: `data` suspends while the team query waits on sign-in, and this
    // provider wraps the whole app.
    const isRoxTeam = createMemo(
      () =>
        currentTeam.isSuccess && currentTeam.data?.team.slug === ROX_TEAM_SLUG
    );

    // Keep the PostHog team group in step with membership: creating, joining,
    // leaving, or renaming a team all refetch this query.
    createEffect(() => {
      if (!currentTeam.isSuccess) return;
      const team = currentTeam.data?.team;
      if (team) analytics.setTeamGroup(team);
      else analytics.clearTeamGroup();
    });

    return {
      isRoxTeam,
    };
  });

export function useIsRoxTeam() {
  return useTeamContext().isRoxTeam;
}
