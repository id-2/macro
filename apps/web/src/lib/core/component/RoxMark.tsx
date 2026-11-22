import type { JSX } from 'solid-js';

/** Installed Rox app icon, served from `public/rox-mark.png`. */
const assetBase = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
export const ROX_MARK_SRC = `${assetBase}rox-mark.png`;

/** The artwork sits inside a transparent margin: 820px of a 1024px file. */
const COVER_SCALE = (1024 / 820) * 1.02;

/** The company mark. Decorative: the nearby name carries the accessible name. */
export function RoxMark(props: {
  class?: string;
  style?: JSX.CSSProperties;
  /** Set on the entry mark so the first screen does not wait on it. */
  fetchpriority?: 'high' | 'low' | 'auto';
  /** Crop the file margin so the artwork meets the frame. Other marks stay inset. */
  cover?: boolean;
}) {
  return (
    <img
      src={ROX_MARK_SRC}
      alt=""
      width={1024}
      height={1024}
      fetchpriority={props.fetchpriority}
      class={
        props.cover ? `rox-mark-cover ${props.class ?? ''}`.trim() : props.class
      }
      style={{
        'object-fit': 'contain',
        ...props.style,
        ...(props.cover
          ? {
              'object-fit': 'cover',
              'max-width': 'none',
              transform: `scale(${COVER_SCALE})`,
              'transform-origin': 'center',
            }
          : {}),
      }}
    />
  );
}
