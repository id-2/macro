import { OnboardingShell } from '@app/features/onboarding/components/onboarding-shell';
import { RoxMark } from '@core/component/RoxMark';
import { displayName } from '@core/constant/brand';
import { Show } from 'solid-js';
import { entryCopy } from './entry-copy';
/** The centered sign-in card, framed and styled like onboarding's slides. */
export function LoginCard(props: {
  /** The header yields to the on-screen keyboard on phones. */
  compact: boolean;
  /** The agent signup page names what it creates. */
  agentSignup?: boolean;
  /** A step carries its own heading and copy, so the card's yields to it. */
  hideHeader?: boolean;
  children: JSX.Element;
}) {
  return (
    <OnboardingShell>
      <div class="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <Show when={!props.compact}>
          <div class="size-20 overflow-hidden rounded-[22px]">
            <RoxMark class="size-full" fetchpriority="high" cover />
          </div>
        </Show>
        <Show when={!props.compact && !props.hideHeader}>
          <h1
            tabindex="-1"
            class="mt-8 whitespace-nowrap font-['Spectral_Entry'] text-[26px] font-medium italic leading-[1.2] tracking-[-.03em] text-ink/90 outline-none sm:text-[30px]"
          >
            {props.agentSignup
              ? entryCopy().agentTitle
              : entryCopy().welcome(displayName)}
          </h1>
          <p class="mt-4 max-w-[330px] font-[Inter_Variable] text-[9.5px] leading-[1.45] tracking-[-.005em] text-ink-muted">
            {props.agentSignup ? entryCopy().agentSubtitle : entryCopy().tagline}
          </p>
        </Show>
        <div
          class={props.compact ? 'w-full text-left' : 'mt-9 w-full text-left'}
        >
          {props.children}
        </div>
      </div>
    </OnboardingShell>
  );
}
