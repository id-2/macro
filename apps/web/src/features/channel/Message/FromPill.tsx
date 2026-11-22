import { UserCardTrigger } from '@core/component/UserCardTrigger';
import { getDisplayName, roxIdToEmail, tryRoxId } from '@core/user';
import { cn } from '@ui';
import { Show } from 'solid-js';
import { useMessage } from './context';

type FromPillProps = {
  class?: string;
};

/**
 * Shows who triggered an agent (bot) message, e.g. `from Eric Hayes`, where the
 * name is a hoverable user reference (same hover card as an `@mention`).
 * Rendered only when the message's sender carries a `triggered_by` user id.
 */
export function FromPill(props: FromPillProps) {
  const message = useMessage();
  const triggeredBy = () => message().sender?.triggered_by ?? undefined;
  const roxId = () => {
    const id = triggeredBy();
    return id ? tryRoxId(id) : undefined;
  };
  const displayName = () => getDisplayName(roxId());
  const email = () => {
    const id = roxId();
    return id ? roxIdToEmail(id) : (triggeredBy() ?? '');
  };
  const label = () => displayName() || email() || (triggeredBy() ?? '');

  return (
    <Show when={triggeredBy()}>
      <span
        class={cn(
          'inline-flex items-center gap-1 text-xs text-ink-muted',
          props.class
        )}
      >
        from
        <UserCardTrigger
          placement="top"
          triggerAs="span"
          user={{
            displayName: label(),
            email: email(),
            id: triggeredBy(),
          }}
          trigger={
            <span class="cursor-default rounded-md p-0.5 font-medium text-accent hover:bg-accent/20 focus:bg-accent/20">
              {label()}
            </span>
          }
        />
      </span>
    </Show>
  );
}
