import {
  repositoryLabel,
  sameRepository,
} from '@app/features/agents-view/core/repository';
import { createPreferredRepository } from '@app/features/agents-view/primitives/preferred-repository';
import { createReachableRepositories } from '@app/features/agents-view/queries/reachable-repositories';
import { t } from '@app/lib/i18n';
import { useSettingsState } from '@core/constant/SettingsState';
import { useUserId } from '@core/context/user';
import { Button } from '@ui';
import { Show } from 'solid-js';
import { SettingsSelect } from './components/settings-select';
import { SettingsRow } from './primitives';

/** Personal repository default row, using the same accessible GitHub listing as the composer. */
export function DefaultRepository() {
  const userId = useUserId();
  const preferred = createPreferredRepository(userId());
  const reachable = createReachableRepositories(() => true);
  const { openSettings } = useSettingsState();
  const listedPreference = () =>
    reachable.repositories().find((repo) => {
      const url = preferred.repository();
      return url && sameRepository(url, repo.url);
    });
  const unavailable = () =>
    !!preferred.repository() &&
    !reachable.loading() &&
    !reachable.error() &&
    !listedPreference();
  const options = () => {
    const options = [
      { id: 'auto', name: t('common.autoDetect') },
      ...reachable
        .repositories()
        .map((repo) => ({ id: repo.url, name: repositoryLabel(repo.url) })),
    ];
    const saved = preferred.repository();
    if (saved && !listedPreference())
      options.push({
        id: saved,
        name: unavailable()
          ? t('settingsAgents.repositoryUnavailable', {
              name: repositoryLabel(saved),
            })
          : repositoryLabel(saved),
      });
    return options;
  };

  return (
    <SettingsRow
      label={t('settingsAgents.defaultRepository')}
      description={t('settingsAgents.defaultRepositoryDescription')}
    >
      <div class="w-full min-w-0 max-w-sm">
        <SettingsSelect
          label={t('settingsAgents.defaultRepository')}
          options={options()}
          value={listedPreference()?.url ?? preferred.repository() ?? 'auto'}
          onChange={(id) => preferred.select(id === 'auto' ? undefined : id)}
        />
        <Show when={reachable.loading()}>
          <p class="mt-2 text-xs text-ink-muted" role="status">
            {t('settingsAgents.loadingRepositories')}
          </p>
        </Show>
        <Show when={reachable.error()}>
          <p class="mt-2 text-xs text-ink-muted" role="status">
            {t('settingsAgents.repositoriesFailed')}
          </p>
          <Button variant="ghost" size="sm" onClick={reachable.retry}>
            {t('settingsAgents.retry')}
          </Button>
        </Show>
        <Show when={unavailable()}>
          <p class="mt-2 text-xs text-ink-muted" role="status">
            {t('settingsAgents.repositoryInaccessible')}
          </p>
        </Show>
        <Show
          when={
            !reachable.loading() &&
            !reachable.error() &&
            reachable.repositories().length === 0
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openSettings('Connected')}
          >
            {t('common.connectGitHub')}
          </Button>
        </Show>
      </div>
    </SettingsRow>
  );
}
