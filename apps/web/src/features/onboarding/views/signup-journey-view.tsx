import { createEffect, type JSX, onCleanup, Show } from 'solid-js';
import {
  animateStepChange,
  focusStepHeading,
} from '../components/motion/step-change';
import { OnboardingShell } from '../components/onboarding-shell';
import { SignInInstead } from '../components/sign-in-instead';
import {
  nextSignupStep,
  previousSignupStep,
  type SignupStep,
} from '../core/signup-draft';
import { createSignupJourney } from '../primitives/signup-journey';
import { StoryStageView } from './story-stage-view';

/** Opening slides, then the email form. Trust and inbox import never open. */
export function SignupJourneyView(props: {
  /** Starts Google sign-up; on web the page navigates away. */
  onGoogle: () => Promise<void>;
  /** Starts Microsoft sign-up; absent while Microsoft sign-up is off. */
  onMicrosoft?: () => Promise<void>;
  onBackFromEmail: () => void;
  /** Sends a returning user to sign in. */
  onSignIn: () => void;
  /** Sends an agent to the agent signup page. */
  onAgentSignup: () => void;
  /** The host's email sign-up form, shown instead of inbox import. */
  emailForm?: JSX.Element;
  showingEmail: boolean;
}) {
  const journey = createSignupJourney({ showingEmail: props.showingEmail });
  let content!: HTMLDivElement;
  let stopMotion: (() => void) | undefined;
  onCleanup(() => stopMotion?.());

  const goTo = (next: SignupStep | undefined) => {
    const current = journey.step();
    if (!next || next === current) return;
    stopMotion?.();
    stopMotion = animateStepChange(content, current, next, () => {
      journey.commit(next);
      queueMicrotask(() => focusStepHeading(content));
    });
  };
  const storyStep = () => {
    const step = journey.step();
    return step === 'welcome' || step === 'vision' ? step : undefined;
  };
  // A saved draft can still name the trust slide. Open the email form instead.
  createEffect(() => {
    if (journey.step() === 'security') journey.commit('work');
  });

  return (
    <OnboardingShell
      wide
      onBack={
        journey.step() === 'welcome'
          ? undefined
          : () => {
              if (props.showingEmail) props.onBackFromEmail();
              else {
                const previous = previousSignupStep(journey.step());
                goTo(previous === 'security' ? 'vision' : previous);
              }
            }
      }
      heroFooter={
        journey.step() === 'welcome' && !props.showingEmail ? (
          <SignInInstead
            onSignIn={props.onSignIn}
            onAgentSignup={props.onAgentSignup}
          />
        ) : undefined
      }
    >
      <div ref={content} class="flex flex-col gap-8">
        <Show
          when={journey.step() === 'work' || journey.step() === 'security'}
          fallback={
            <StoryStageView
              step={storyStep() ?? 'welcome'}
              onNext={() => {
                const next = nextSignupStep(journey.step());
                goTo(next === 'security' || next === 'work' ? 'work' : next);
              }}
              onWorkspaceContinue={(color) => {
                journey.setAccent(color);
                goTo('vision');
              }}
            />
          }
        >
          <div class="mx-auto flex w-full max-w-sm flex-col gap-8">
            <h1
              tabindex="-1"
              class="text-center font-[Roboto_Slab_Variable] text-[clamp(24px,7.6vw,30px)] font-[315] leading-tight tracking-tight"
            >
              Зарегистрируйтесь по почте.
            </h1>
            {props.emailForm}
          </div>
        </Show>
      </div>
    </OnboardingShell>
  );
}
