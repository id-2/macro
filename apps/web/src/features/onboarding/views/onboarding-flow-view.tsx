import { fireAndForget } from '@core/util/fireAndForget';
import {
  createEffect,
  createSignal,
  Match,
  onCleanup,
  Switch,
} from 'solid-js';
import {
  animateStepChange,
  focusStepHeading,
} from '../components/motion/step-change';
import { OnboardingShell } from '../components/onboarding-shell';
import { StepFallback } from '../components/step-fallback';
import { useOnboardingContext } from '../context/onboarding-context';
import type { CheckoutReturn } from '../core/checkout';
import {
  isStoryStep,
  type OnboardingStep,
  previousOnboardingStep,
  type StepOutcome,
  visibleOnboardingStep,
} from '../core/steps';
import { createFlowFinish } from '../primitives/flow-finish';
import { createOnboardingFlow } from '../primitives/onboarding-flow';
import { HandleStep } from './handle-step';
import { PlanComparisonView } from './plan-comparison-view';
import { type InviteOfferSlot, PlanStep } from './plan-step';
import { StoryStageView } from './story-stage-view';
import { TeamStep } from './team-step';
import { ToolsStep } from './tools-step';

/** The signed-in onboarding steps, from the workspace slides to the trial offer. */
export function OnboardingFlowView(props: {
  /** A deep link to land on after onboarding. */
  next: string | undefined;
  /** Raw `?step` from the entry link. Unknown values are ignored. */
  step?: string;
  checkoutReturn: CheckoutReturn | undefined;
  onNavigate: (target: string) => void;
  /** Leaves the app for hosted checkout. */
  onRedirect: (url: string) => void;
  onSignedOut: () => void;
  /** Shown instead of the trial to an account holding an invite promotion. */
  renderInviteOffer: InviteOfferSlot;
  /**
   * The page was opened on purpose. A finished account walks the flow again
   * instead of being sent straight out of it.
   */
  restart?: boolean;
}) {
  const context = useOnboardingContext();
  const emailAccounts = context.createEmailAccounts();
  // Read once for the completion rollup; only the tools step polls.
  const connectedTools = context.createConnectedTools({ poll: false });
  const record = context.createOnboardingRecord();
  const teamDirectory = context.createTeamDirectory({
    domain: () => undefined,
    ownEmail: () => undefined,
  });

  const finish = createFlowFinish(context, {
    next: () => props.next,
    onNavigate: props.onNavigate,
    onRedirect: props.onRedirect,
    completionRollup: () => {
      const accounts = emailAccounts.accounts();
      return {
        emails_connected: accounts.t === 'ready' ? accounts.value.length : 0,
        connectors_connected: [...connectedTools.connected()],
      };
    },
  });
  const flow = createOnboardingFlow(context, {
    checkoutReturn: () => props.checkoutReturn,
    requestedStep: () => props.step,
    record,
    signupMethod: () => {
      const accounts = emailAccounts.accounts();
      if (accounts.t !== 'ready') return undefined;
      return accounts.value.length > 0 ? 'google' : 'email_code';
    },
    finishing: finish.finishing,
    restart: () => props.restart === true,
  });

  // The person's first generation starts as soon as an inbox is connected,
  // whether or not the flow ends with the routines step; the server runs it
  // once per person, so once here is enough.
  let generationStarted = false;
  createEffect(() => {
    if (generationStarted || !context.suggestionGenerationEnabled()) return;
    const accounts = emailAccounts.accounts();
    if (accounts.t !== 'ready' || accounts.value.length === 0) return;
    generationStarted = true;
    context.startSuggestionGeneration();
  });

  // Leaving is the host's decision; the flow only reports why.
  createEffect(() => {
    const status = flow.status();
    if (status.t === 'signed-out') props.onSignedOut();
    else if (status.t === 'complete') props.onNavigate(finish.afterTarget());
  });

  let content!: HTMLDivElement;
  let stopMotion: (() => void) | undefined;
  onCleanup(() => stopMotion?.());

  const step = () => {
    const status = flow.status();
    return status.t === 'active' ? status.step : undefined;
  };
  const storyStep = () => {
    const current = step();
    if (!current || current === 'security' || !isStoryStep(current))
      return undefined;
    return current;
  };
  // A handle already on the account used to open inbox import. Land past it.
  createEffect(() => {
    const current = step();
    if (!current) return;
    const landed = visibleOnboardingStep(current);
    if (landed !== current) flow.commit(landed);
  });

  const goTo = (next: OnboardingStep | undefined) => {
    const landed = next ? visibleOnboardingStep(next) : undefined;
    const current = step();
    if (!landed || !current || landed === current) return;
    stopMotion?.();
    stopMotion = animateStepChange(content, current, landed, () => {
      flow.commit(landed);
      queueMicrotask(() => focusStepHeading(content));
    });
  };
  // Someone who already joined a team (invite link or domain) has nothing to
  // do on the team step, so the flow passes over it in both directions.
  const passesTeam = (target: OnboardingStep | undefined) => {
    const teams = teamDirectory.teams();
    return target === 'team' && teams.t === 'ready' && teams.value.length > 0;
  };
  const licensed = () => {
    const viewer = context.viewer();
    return viewer.t === 'signed-in' && viewer.viewer.licensed;
  };
  // The plan is settled before the routines step, but onboarding completes
  // after it; a reload there falls back to what the license says.
  const [finishPlan, setFinishPlan] = createSignal<() => Promise<void>>();
  // With suggestions off there is no routines step: the plan finishes.
  const choosePlan = (finishWith: () => Promise<void>) => {
    if (finish.finishing()) return;
    if (!context.routineSuggestionsEnabled()) {
      fireAndForget(finishWith(), 'onboarding');
      return;
    }
    setFinishPlan(() => finishWith);
    flow.leave('completed');
    goTo('routines');
  };
  const finishOnboarding = () => {
    const finishWith =
      finishPlan() ??
      (licensed() ? () => finish.finishPremium() : () => finish.finishFree());
    return finishWith();
  };
  const advance = (outcome: StepOutcome = 'completed') => {
    if (finish.finishing()) return;
    const next = flow.leave(outcome);
    const skipsTeam = passesTeam(next);
    if (skipsTeam)
      context.track('onboarding_v4_team', { action: 'already_on_team' });
    const viewer = context.viewer();
    if (
      (step() === 'team' || skipsTeam) &&
      viewer.t === 'signed-in' &&
      viewer.viewer.licensed
    ) {
      choosePlan(() => finish.finishPremium());
      return;
    }
    goTo(skipsTeam ? 'plan' : next);
  };
  const showPlanOffer = () => {
    const viewer = context.viewer();
    return (
      step() === 'plan' &&
      props.checkoutReturn?.t !== 'success' &&
      viewer.t === 'signed-in' &&
      !viewer.viewer.licensed
    );
  };
  const back = () => {
    const current = step();
    // The plan is settled (and maybe paid for) once routines show.
    if (current === 'routines') return undefined;
    const previous = current && previousOnboardingStep(current);
    const target = passesTeam(previous) ? 'tools' : previous;
    return target && !finish.finishing() ? () => goTo(target) : undefined;
  };

  return (
    <OnboardingShell
      wide
      onBack={back()}
      explainerLabel={showPlanOffer() ? 'See more' : undefined}
      explainer={
        showPlanOffer() ? (
          <PlanComparisonView
            disabled={finish.finishing()}
            onContinueFree={() => choosePlan(() => finish.finishFree())}
            onBackToPro={() => focusStepHeading(content, true)}
            onStartMax={() =>
              fireAndForget(
                finish.startPremiumCheckout('max', 'standard'),
                'onboarding'
              )
            }
          />
        ) : undefined
      }
    >
      <div ref={content} class="flex flex-col gap-8">
        <Switch fallback={<StepFallback />}>
          <Match when={storyStep()}>
            {(story) => (
              <StoryStageView
                step={story()}
                onNext={() => advance()}
                onWorkspaceContinue={(color) => {
                  const viewer = context.viewer();
                  if (viewer.t !== 'signed-in') return;
                  context.applyAccent(color, viewer.viewer.id);
                  advance();
                }}
              >
                <ToolsStep onContinue={() => advance()} />
              </StoryStageView>
            )}
          </Match>
          <Match when={step() === 'handle'}>
            <HandleStep onContinue={() => advance()} />
          </Match>

          <Match when={step() === 'team'}>
            <TeamStep
              finishing={finish.finishing()}
              onContinue={() => advance()}
              onSkip={() => advance('skipped')}
            />
          </Match>
          <Match when={step() === 'plan'}>
            <PlanStep
              checkoutReturn={props.checkoutReturn}
              finishing={finish.finishing()}
              onStartCheckout={(tier, terms) =>
                fireAndForget(
                  finish.startPremiumCheckout(tier, terms),
                  'onboarding'
                )
              }
              onContinueFree={() => choosePlan(() => finish.finishFree())}
              renderInviteOffer={props.renderInviteOffer}
              onPremiumPaid={async (tier) =>
                choosePlan(() => finish.finishPremium(tier))
              }
            />
          </Match>
          <Match when={step() === 'routines'}>
            <FinishSilently
              finishing={finish.finishing()}
              onFinish={() => fireAndForget(finishOnboarding(), 'onboarding')}
            />
          </Match>
        </Switch>
      </div>
    </OnboardingShell>
  );
}

/**
 * Ends onboarding where the routine picker used to open. The step stays in the
 * graph so plan → finish keeps one path; nothing of it is drawn.
 */
function FinishSilently(props: { finishing: boolean; onFinish: () => void }) {
  let fired = false;
  createEffect(() => {
    if (fired) return;
    fired = true;
    props.onFinish();
  });
  return (
    <div class="flex min-h-40 items-center justify-center text-sm text-ink-muted">
      {props.finishing ? 'Открываем рабочее пространство…' : null}
    </div>
  );
}
