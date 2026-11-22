import { ROX_MARK_SRC } from '@core/component/RoxMark';
import type { JSX } from 'solid-js';
import { BaseTool } from './BaseTool';
import { createToolRenderer } from './ToolRenderer';

/**
 * `BaseTool` takes an SVG icon; the Rox mark is the app's shared PNG, so this
 * draws it inside an SVG. The artwork covers 820 of the file's 1024 px, so the
 * image is scaled and shifted to meet the frame like `RoxMark`'s `cover` crop.
 */
const RoxMarkIcon = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => (
  <svg
    viewBox="0 0 1024 1024"
    class={props.class}
    classList={props.classList}
    aria-hidden="true"
  >
    <image href={ROX_MARK_SRC} x="-140" y="-140" width="1304" height="1304" />
  </svg>
);

/**
 * `SelfKnowledge` renders as a standard tool row: the Rox mark and a "Self
 * knowledge" label. The about-Rox page it returns is self-reflection the
 * model did, not an action the user needs to inspect, so the result is hidden
 * and the row has no expand toggle.
 */
const handler = createToolRenderer({
  name: 'SelfKnowledge',
  render: (ctx) => (
    <BaseTool icon={RoxMarkIcon} renderContext={ctx.renderContext} type="call">
      Self knowledge
    </BaseTool>
  ),
});

export const selfKnowledgeHandler = handler;
