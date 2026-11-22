import { RoxMark } from '@core/component/RoxMark';
import { cn } from '@ui';
import { createSignal, onMount } from 'solid-js';

/**
 * The Rox mark, breathing while content loads. It is the same artwork as the
 * boot shell and the install icon, so every waiting surface shows one glyph.
 */
export function LoadingSpinner(props: { class?: string }) {
  return (
    <div
      class={cn(
        'size-48 p-14 animate-pulse motion-reduce:animate-none',
        props.class
      )}
    >
      <RoxMark class="size-full" />
    </div>
  );
}

export function LoadingPanel() {
  const [showSpinner, setShowSpinner] = createSignal(false);

  onMount(() => {
    const timeoutId = setTimeout(() => {
      setShowSpinner(true);
    }, 500);

    return () => clearTimeout(timeoutId);
  });

  return (
    <div
      class="flex flex-col size-full justify-center items-center relative font-mono"
      classList={{
        'opacity-100': showSpinner(),
        'opacity-0': !showSpinner(),
      }}
    >
      <LoadingSpinner />
    </div>
  );
}
