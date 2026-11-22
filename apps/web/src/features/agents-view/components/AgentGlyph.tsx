import { CURSOR_BOT_ID } from '@core/constant/cursorAgent';
import { ROX_AGENT_BOT_ID } from '@core/constant/roxAgent';
import { ROX_CODER_BOT_ID } from '@core/constant/roxCoder';
import { RoxMark } from '@core/component/RoxMark';
import CodeIcon from '@icon/system/regular/code.svg';
import RobotIcon from '@icon/system/regular/robot.svg';
import CursorIcon from '@icon/wide-cursor-ide.svg';
import { type JSX, Show } from 'solid-js';
import { ROX_PERSONA_ID } from '../core/roster';

/** What an agent's avatar shows when it has no picture of its own. */
export type GlyphAgent = {
  id: string;
  botId?: string;
  name: string;
  avatarUrl?: string;
};

const ROX_IDS: ReadonlySet<string> = new Set([
  ROX_PERSONA_ID,
  ROX_AGENT_BOT_ID,
  ROX_CODER_BOT_ID,
]);

/** The mark for an agent: Rox's own logo, Cursor's, or a robot. */
export function AgentIcon(props: {
  agent: Pick<GlyphAgent, 'id' | 'botId'>;
  class?: string;
}) {
  const id = () => props.agent.botId ?? props.agent.id;
  return (
    <Show
      when={ROX_IDS.has(id())}
      fallback={
        <Show
          when={id() === CURSOR_BOT_ID}
          fallback={<RobotIcon class={props.class ?? 'ph'} />}
        >
          <CursorIcon class={props.class ?? 'ph'} />
        </Show>
      }
    >
      <RoxMark class={props.class ?? 'ph'} />
    </Show>
  );
}

/** The `</>` mark a coder wears on its avatar. */
export function CodeMark(props: { hidden?: boolean }) {
  return (
    <span class="codemark" aria-hidden="true" hidden={props.hidden}>
      <CodeIcon class="ph" />
    </span>
  );
}

/**
 * Avatar with the coder mark. `cls` names the avatar shape the design uses
 * where it sits: `av` in cards and rows, `bigav` in the editor.
 */
export function AgentAvatar(props: {
  agent: GlyphAgent;
  coder: boolean;
  cls?: 'av' | 'bigav';
  children?: JSX.Element;
}) {
  return (
    <span class="avw">
      <span class={props.cls ?? 'av'}>
        <Show
          when={props.agent.avatarUrl}
          fallback={<AgentIcon agent={props.agent} />}
        >
          {(url) => (
            <img
              src={url()}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                'object-fit': 'cover',
                'border-radius': 'inherit',
              }}
            />
          )}
        </Show>
      </span>
      <Show when={props.coder}>
        <CodeMark />
      </Show>
      {props.children}
    </span>
  );
}
