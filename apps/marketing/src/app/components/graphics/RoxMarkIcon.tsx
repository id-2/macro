import type { JSX } from 'solid-js';
import RoxMarkIcon from '../../../assets/app-icons/rox-logo.svg';

export function RoxMarkIcon(props: {
  style?: JSX.CSSProperties;
  class?: string;
}) {
  return (
    <RoxMarkIcon aria-hidden="true" class={props.class} style={props.style} />
  );
}
