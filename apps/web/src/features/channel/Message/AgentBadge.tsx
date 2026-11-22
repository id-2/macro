import { AgentTag } from '@core/component/AgentTag';
import { isAgentAccount, tryRoxId } from '@core/user';
import { isBotSenderId } from '@queries/messages/message-sender';
import { Show } from 'solid-js';
import { useMessage } from './context';

type AgentBadgeProps = {
  class?: string;
};

/**
 * Small "Agent" badge shown next to a bot or agent account's name so it's
 * clear the message is from an agent rather than a person.
 */
export function AgentBadge(props: AgentBadgeProps) {
  const message = useMessage();
  const isAgent = () => {
    const senderId = message().sender_id;
    return isBotSenderId(senderId) || isAgentAccount(tryRoxId(senderId));
  };

  return (
    <Show when={isAgent()}>
      <AgentTag class={props.class} />
    </Show>
  );
}
