import { t } from '@app/lib/i18n';
import CloudIcon from '@icon/system/regular/cloud.svg';
import CloudWarningIcon from '@icon/system/regular/cloud-warning.svg';
import { SyncSourceStatus } from '@rox-one/collaboration/collab/source';
import { Tooltip } from '@ui';
import { Match, Switch } from 'solid-js';

export function isCollaborationStatusVisible(
  status: SyncSourceStatus | undefined
): boolean {
  return (
    status === SyncSourceStatus.Disconnected ||
    status === SyncSourceStatus.Connecting
  );
}

export function CollaborationStatusIndicator(props: {
  status: SyncSourceStatus | undefined;
}) {
  return (
    <Switch>
      <Match when={props.status === SyncSourceStatus.Disconnected}>
        <Tooltip
          as="span"
          label={t('nav.offlineTooltip')}
        >
          <span
            role="status"
            aria-label={t('nav.offline')}
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-alert/20 bg-alert-bg text-alert-ink [&>svg]:size-4"
          >
            <CloudWarningIcon />
          </span>
        </Tooltip>
      </Match>
      <Match when={props.status === SyncSourceStatus.Connecting}>
        <Tooltip as="span" label={t('nav.reconnectingTooltip')}>
          <span
            role="status"
            aria-label={t('nav.reconnecting')}
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent text-ink-extra-muted [&>svg]:size-4"
          >
            <CloudIcon class="animate-pulse" />
          </span>
        </Tooltip>
      </Match>
    </Switch>
  );
}
