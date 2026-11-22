import type { PaidPlanTier } from '@app/features/paywall/plans';
import { t } from '@app/lib/i18n';
import { fireAndForget } from '@core/util/fireAndForget';
import { Button } from '@ui';
import { type Accessor, type JSX, Show } from 'solid-js';
import { match } from 'ts-pattern';
import { ContinueButton, SecondaryButton } from '../components/controls';
import {
  type InviteOffer,
  useOnboardingContext,
} from '../context/onboarding-context';
import type { CheckoutReturn, CheckoutTerms } from '../core/checkout';
import { createPlanConfirmation } from '../primitives/plan-confirmation';

/** The host's panel for an invite promotion, shown in place of the trial offer. */
export type InviteOfferSlot = (
  offer: InviteOffer,
  actions: {
    finishing: Accessor<boolean>;
    onClaim: () => void;
    onContinueFree: () => void;
  }
) => JSX.Element;

/** Stripe owns payment details. Verify the webhook-updated license before leaving setup. */
export function PlanStep(props: {
  checkoutReturn: CheckoutReturn | undefined;
  finishing: boolean;
  onStartCheckout: (tier: PaidPlanTier, terms: CheckoutTerms) => void;
  onPremiumPaid: (tier: PaidPlanTier) => Promise<void>;
  onContinueFree: () => void;
  renderInviteOffer: InviteOfferSlot;
}) {
  const context = useOnboardingContext();
  const plan = createPlanConfirmation(context, {
    checkoutReturn: props.checkoutReturn,
    onConfirmed: props.onPremiumPaid,
  });
  const offer = context.createInviteOffer();
  const trial = context.createTrialEligibility();
  const trialEligible = () => {
    const eligibility = trial.eligibility();
    return eligibility.t === 'ready' && eligibility.value;
  };
  // An invite's free months beat the trial, which would replace them.
  const inviteOffer = () => {
    const state = offer();
    return trial.eligibility().t === 'ready' &&
      !trial.existingSubscription() &&
      plan.state().t === 'offer' &&
      state.t === 'ready'
      ? state.value
      : null;
  };

  const subscriptionOffer = () => (
    <section class="mx-auto flex w-full max-w-lg flex-col py-2 sm:py-4">
      <header class="text-center">
        <h1
          tabindex="-1"
          class="font-[Roboto_Slab_Variable] text-[clamp(1.75rem,8vw,3rem)] font-[315] leading-[1.12] tracking-tight outline-none text-balance"
        >
          {plan.state().t === 'offer'
            ? trial.existingSubscription()
              ? t('onboarding.planManageTitle')
              : trialEligible()
                ? t('onboarding.planTrialTitle')
                : t('onboarding.planProTitle')
            : t('onboarding.planReadyTitle')}
        </h1>
        <p class="mx-auto mt-6 max-w-[400px] text-sm leading-6 text-ink-muted text-balance sm:text-[15px]">
          {plan.state().t === 'offer'
            ? trial.existingSubscription()
              ? t('onboarding.planExistingBody')
              : trialEligible()
                ? t('onboarding.planTrialBody')
                : t('onboarding.planProBody')
            : t('onboarding.planConfirmingBody')}
        </p>
      </header>
      <Show
        when={(() => {
          const state = plan.state();
          return state.t === 'continue' && state.stillWaiting;
        })()}
      >
        <p role="alert" class="mt-8 text-center text-sm text-ink-muted">
          {t('onboarding.planWaitingPayment')}
        </p>
      </Show>
      <div class="mt-9">
        <ContinueButton
          label={match(plan.state())
            .with({ t: 'confirming' }, () =>
              t('onboarding.confirmingSubscription')
            )
            .otherwise((state) =>
              props.finishing
                ? t('onboarding.openingWorkspace')
                : state.t === 'continue'
                  ? t('onboarding.continueToWorkspace')
                  : trial.existingSubscription()
                    ? t('onboarding.manageSubscription')
                    : trial.eligibility().t === 'loading'
                      ? t('onboarding.loadingProOffer')
                      : trialEligible()
                        ? t('onboarding.startTrial')
                        : t('onboarding.getPro')
            )}
          // Free is always an exit from the offer, including when the lookup
          // fails or an invite is still loading: Pro must never be the only way
          // into the workspace.
          secondary={
            <Show
              when={
                plan.state().t === 'offer' && !trial.existingSubscription()
              }
            >
              <SecondaryButton
                label={t('onboarding.continueFree')}
                disabled={props.finishing || trial.managing()}
                onClick={props.onContinueFree}
              />
            </Show>
          }
          // Until the invite lookup settles, starting a trial could skip it.
          disabled={
            plan.state().t === 'confirming' ||
            props.finishing ||
            trial.managing() ||
            (plan.state().t === 'offer' &&
              !trial.existingSubscription() &&
              (offer().t === 'loading' || trial.eligibility().t !== 'ready'))
          }
          onClick={() => {
            if (plan.state().t !== 'offer') {
              fireAndForget(plan.confirm(), 'onboarding');
            } else if (trial.existingSubscription()) {
              fireAndForget(trial.manage(), 'onboarding');
            } else {
              props.onStartCheckout(
                'premium',
                trialEligible() ? 'trial' : 'standard'
              );
            }
          }}
        />
      </div>
      <Show when={plan.state().t === 'offer' && !trial.existingSubscription()}>
        <p class="mx-auto mt-3 max-w-52 text-center text-xs leading-5 text-ink-extra-muted">
          <span class="block">{t('onboarding.billedMonthly')}</span>
          <span class="block">
            {trialEligible()
              ? t('onboarding.afterTrialCancel')
              : t('onboarding.cancelAnytime')}
          </span>
        </p>
      </Show>
      <Show
        when={
          plan.state().t === 'offer' &&
          !trial.existingSubscription() &&
          trial.eligibility().t === 'error'
        }
      >
        <div role="alert" class="mt-4 text-center text-sm text-ink-muted">
          <p>{t('onboarding.offerConfirmFailed')}</p>
          <p>{t('onboarding.continueFreeInstead')}</p>
          <Button variant="ghost" size="sm" onClick={trial.retry}>
            {t('onboarding.retry')}
          </Button>
        </div>
      </Show>
    </section>
  );

  return (
    <Show when={inviteOffer()} keyed fallback={subscriptionOffer()}>
      {(invite) =>
        props.renderInviteOffer(invite, {
          finishing: () => props.finishing,
          onClaim: () => props.onStartCheckout('premium', 'invite-offer'),
          onContinueFree: props.onContinueFree,
        })
      }
    </Show>
  );
}
