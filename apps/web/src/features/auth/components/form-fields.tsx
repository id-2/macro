import { cn } from '@ui/utils/classname';
import { type JSX, onCleanup, onMount, Show, splitProps } from 'solid-js';

/**
 * The Stepper resolves a step's JSX (firing onMount) before attaching it to the
 * document, so the field is still detached there. Poll until it's connected.
 */
function useAttachFocus(enabled: () => boolean) {
  let element: HTMLInputElement | undefined;
  onMount(() => {
    if (!enabled()) return;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    const focusWhenConnected = () => {
      if (cancelled || !element) return;
      if (element.isConnected) element.focus({ preventScroll: true });
      else requestAnimationFrame(focusWhenConnected);
    };
    focusWhenConnected();
  });
  return (node: HTMLInputElement) => {
    element = node;
  };
}

export function FormInput(props: {
  id: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  autoFocus?: boolean;
  autocomplete?: string;
  /** Extra classes for the input, e.g. room for a fixed suffix. */
  class?: string;
  onInput: (value: string) => void;
}) {
  const attachInput = useAttachFocus(() => props.autoFocus !== false);
  return (
    <input
      ref={attachInput}
      id={props.id}
      name={props.id}
      type={props.type ?? 'text'}
      placeholder={props.placeholder}
      value={props.value}
      required={props.required ?? true}
      autocomplete={props.autocomplete ?? props.id}
      onInput={(event) => props.onInput(event.currentTarget.value)}
      class={cn(
        'obf-input w-full rounded-2xl border border-edge bg-input px-4 py-3 text-sm text-ink placeholder:text-ink-placeholder transition-colors focus:border-ink/40 focus:outline-none user-invalid:border-failure',
        props.class
      )}
    />
  );
}

/**
 * One compound control: the text field and a fixed suffix share a single frame
 * (one border, one focus ring, no seam), so a typed local part reads together
 * with the domain it completes.
 */
export function FormSuffixInput(props: {
  id: string;
  placeholder?: string;
  value: string;
  /** Fixed text after the field, e.g. the mail domain. */
  suffix: string;
  autocomplete?: string;
  /** The value was rejected: tint this same frame instead of adding a box. */
  invalid?: boolean;
  /** Off when the form explains an empty value itself, in its own words. */
  required?: boolean;
  /** The heading above is not a label, so name the field for screen readers. */
  ariaLabel?: string;
  onInput: (value: string) => void;
}) {
  const attachInput = useAttachFocus(() => true);
  return (
    <div
      class={cn(
        'obf-field relative flex h-14 items-center overflow-hidden rounded-2xl border shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_-1px_0_rgb(15_20_40/0.04)] transition-[border-color,box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none',
        'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10',
        props.invalid
          ? 'border-failure/45 bg-failure/[0.06]'
          : 'border-ink/12 bg-ink/[0.03] focus-within:border-ink/35'
      )}
    >
      <input
        ref={attachInput}
        id={props.id}
        name={props.id}
        type="text"
        placeholder={props.placeholder}
        value={props.value}
        required={props.required ?? true}
        autocomplete={props.autocomplete ?? props.id}
        aria-label={props.ariaLabel}
        aria-invalid={props.invalid || undefined}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        class="h-full min-w-0 flex-1 bg-transparent pl-4 pr-3 text-sm leading-5 text-ink placeholder:text-ink-placeholder focus:outline-none"
      />
      {/* Fixed text, not part of what the person types; the hairline that
          separates it fades out top and bottom so the frame stays one object.
          The suffix is its own flex column, never positioned over the field:
          it keeps a fit-content width that its text can never overflow, so no
          last character is cut off at any width, and the field's right padding
          stays wider than the hairline gap. */}
      <span
        aria-hidden="true"
        class="relative flex h-full shrink-0 select-none items-center whitespace-nowrap pl-3.5 pr-4 font-['Rox_Mono_Entry'] text-[13px] font-light leading-5 tracking-[-0.01em] text-ink-muted tabular-nums"
      >
        <span class="pointer-events-none absolute inset-y-2.5 left-0 w-px bg-gradient-to-b from-transparent via-ink/15 to-transparent" />
        {props.suffix}
      </span>
    </div>
  );
}

export function FormError(props: { message?: string }) {
  return (
    <Show when={props.message}>
      <p role="alert" class="text-xs text-failure leading-snug">
        {props.message}
      </p>
    </Show>
  );
}

/** Onboarding's pill buttons: filled for the main action, outlined otherwise. */
export function AuthButton(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary';
  }
) {
  const [local, rest] = splitProps(props, ['variant', 'class', 'type']);
  return (
    <button
      type={local.type ?? 'button'}
      class={cn(
        'flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-base font-medium transition-[opacity,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40',
        local.variant === 'secondary'
          ? 'border border-edge text-ink hover:bg-ink/5'
          : 'bg-ink text-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(15_20_40/0.18)] hover:opacity-95',
        local.class
      )}
      {...rest}
    />
  );
}
