/**
 * Resolved permission outcomes in the transcript. Pending decisions live
 * above the composer so there is only one place to answer them.
 */

import { t } from '@app/lib/i18n';
import type { MessagePart } from '@service-agent-fold/generated/types';
import { Show } from 'solid-js';
import { match } from 'ts-pattern';
import { ToolCard } from '../../ui';

export function PermissionPart(props: {
  part: Extract<MessagePart, { kind: 'permission' }>;
}) {
  const outcome = () => {
    const resolved = props.part.outcome;
    if (resolved.kind === 'pending') {
      return t('agentChat.noLongerWaiting');
    }
    if (resolved.kind === 'cancelled') return 'Cancelled';
    if (resolved.kind === 'errored') return t('agentChat.failed');
    if (resolved.kind === 'unrecognized') return 'Answered';
    const chosen = props.part.options.find(
      (option) => option.id === resolved.optionId
    );
    if (!chosen) return 'Answered';
    return match(chosen.kind)
      .with('allow_once', () => 'Allowed once')
      .with('allow_always', () => 'Always allowed')
      .with('reject_once', () => 'Denied')
      .with('reject_always', () => 'Denial remembered')
      .exhaustive();
  };

  return (
    <Show when={props.part.outcome.kind !== 'pending'}>
      <ToolCard
        title={t('agentChat.permission')}
        trailing={<span class="text-ink">{outcome()}</span>}
        status="completed"
      />
    </Show>
  );
}
