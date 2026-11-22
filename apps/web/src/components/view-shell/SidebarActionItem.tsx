import { pressHandlers } from '@ui';
import {
  type Component,
  type ComponentProps,
  createUniqueId,
  type JSX,
  Show,
} from 'solid-js';
import { ViewSidebar } from './ViewSidebar';

type SvgIcon = Component<ComponentProps<'svg'>>;

/**
 * A sidebar row that acts on press. The gradient paints the icon and label
 * the same way as the settings invite action, so a promoted action reads as
 * one sweep instead of a bordered button.
 */
export function ActionItem(props: {
  icon: SvgIcon;
  label: string;
  /** Paint the icon and label in a soft gradient to draw the eye. */
  gradient?: boolean;
  onPress: () => void;
}) {
  const gradientId = createUniqueId();
  return (
    <ViewSidebar.Item {...pressHandlers(() => props.onPress())}>
      <ViewSidebar.Icon>
        <Show when={props.gradient} fallback={<props.icon class="size-4" />}>
          {/* Inline size: ViewSidebar.Icon sizes every child svg. */}
          <svg
            aria-hidden="true"
            style={{ position: 'absolute', width: '0', height: '0' }}
          >
            <defs>
              {/* Icons use a 24×24 viewBox; userSpaceOnUse keeps one sweep
                  across every path instead of one per path. Stops go in
                  style because presentation attributes can't resolve var(). */}
              <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="24"
                y2="0"
              >
                <stop offset="0" style={{ 'stop-color': GRADIENT_STOPS[0] }} />
                <stop offset="1" style={{ 'stop-color': GRADIENT_STOPS[1] }} />
              </linearGradient>
            </defs>
          </svg>
          <props.icon
            class="size-4"
            style={{ stroke: `url(#${gradientId})` }}
          />
        </Show>
      </ViewSidebar.Icon>
      <span
        class="truncate font-medium"
        style={props.gradient ? GRADIENT_TEXT_STYLE : undefined}
      >
        {props.label}
      </span>
    </ViewSidebar.Item>
  );
}

/**
 * A restrained pink → violet → indigo sweep. The icon carries the first leg
 * and the label picks up from there, so the two read as one gradient. Each hue
 * is pulled 40% toward the ink color, which mutes it and keeps the small label
 * at 4.5:1 or better on both the light and dark sidebars.
 */
const GRADIENT_STOPS = ['#d6409f', '#8e4ec6', '#3e63dd'].map(
  (hue) => `color-mix(in oklch, ${hue} 60%, var(--color-ink))`
);

const GRADIENT_TEXT_STYLE: JSX.CSSProperties = {
  'background-image': `linear-gradient(90deg, ${GRADIENT_STOPS.slice(1).join(', ')})`,
  'background-clip': 'text',
  '-webkit-background-clip': 'text',
  color: 'transparent',
};
