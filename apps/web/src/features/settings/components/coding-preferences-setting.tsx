import { t } from '@app/lib/i18n';
import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import {
  useCodingPreferencesQuery,
  useSetCodingPreferencesMutation,
} from '@queries/agents/coding-preferences';
import type { CodingPreferencesBody } from '@service-agent-harness/client';
import { ToggleSwitch } from '@ui';
import { DefaultRepository } from '../DefaultRepository';
import { SettingsCard, SettingsRow, SettingsSection } from '../primitives';

/** Defaults for the user's new coding sessions: repository, tasks, and pull requests. */
export function CodingPreferencesSetting() {
  const preferences = useCodingPreferencesQuery();
  const setPreferences = useSetCodingPreferencesMutation();

  const toggle = async (
    current: CodingPreferencesBody,
    preference: keyof CodingPreferencesBody,
    enabled: boolean
  ) => {
    try {
      await setPreferences.mutateAsync({ ...current, [preference]: enabled });
    } catch {
      toast.failure(t('settingsAgents.codingPreferencesFailed'));
    }
  };

  const PreferenceRow = (props: {
    preference: keyof CodingPreferencesBody;
    label: string;
    description: string;
  }) => (
    <SettingsRow label={props.label} description={props.description}>
      <ToggleSwitch
        size="md"
        label={props.label}
        labelClass="sr-only"
        checked={preferences.isSuccess && preferences.data[props.preference]}
        disabled={!preferences.isSuccess}
        onChange={(enabled) => {
          if (!preferences.isSuccess) return;
          fireAndForget(
            toggle(preferences.data, props.preference, enabled),
            'coding-preferences'
          );
        }}
      />
    </SettingsRow>
  );

  return (
    <SettingsSection title={t('settingsAgents.codingSessions')}>
      <SettingsCard>
        <DefaultRepository />
        <PreferenceRow
          preference="createTasks"
          label={t('settingsAgents.createTasks')}
          description={t('settingsAgents.createTasksDescription')}
        />
        <PreferenceRow
          preference="openPullRequests"
          label={t('settingsAgents.openPullRequests')}
          description={t('settingsAgents.openPullRequestsDescription')}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
