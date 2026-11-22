import { t } from '@app/lib/i18n';
import ArrowUpIcon from '@icon/system/regular/arrow-up.svg';
import CaretDownIcon from '@icon/system/regular/caret-down.svg';
import { For, type JSX, Match, Show, Switch } from 'solid-js';

function EvidenceLink(props: { href: string; children: JSX.Element }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer"
      class="rounded-sm text-ink-muted underline decoration-ink-extra-muted underline-offset-4 hover:text-ink focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      {props.children}
    </a>
  );
}

type TrustQuestion = { title: string; answer: JSX.Element };

function googleQuestions(): TrustQuestion[] {
  return [
    {
      title: t('onboarding.trustGoogleQ1'),
      answer: <>{t('onboarding.trustGoogleQ1Answer')}</>,
    },
    {
      title: t('onboarding.trustGoogleQ2'),
      answer: <>{t('onboarding.trustGoogleQ2Answer')}</>,
    },
    {
      title: t('onboarding.trustGoogleQ3'),
      answer: <>{t('onboarding.trustGoogleQ3Answer')}</>,
    },
    {
      title: t('onboarding.trustGoogleQ4'),
      answer: (
        <>
          {t('onboarding.trustGoogleQ4AnswerBefore')}{' '}
          <EvidenceLink href="https://rox.one/privacy/">
            {t('onboarding.trustPrivacyPolicy')}
          </EvidenceLink>
          {t('onboarding.trustGoogleQ4AnswerAfter')}
        </>
      ),
    },
  ];
}

/** Microsoft sign-in is identity-only; Outlook access is its own consent. */
function microsoftQuestions(): TrustQuestion[] {
  return [
    {
      title: t('onboarding.trustMicrosoftQ1'),
      answer: <>{t('onboarding.trustMicrosoftQ1Answer')}</>,
    },
    {
      title: t('onboarding.trustMicrosoftQ2'),
      answer: <>{t('onboarding.trustMicrosoftQ2Answer')}</>,
    },
    {
      title: t('onboarding.trustMicrosoftQ3'),
      answer: <>{t('onboarding.trustMicrosoftQ3Answer')}</>,
    },
  ];
}

function securityQuestions(): TrustQuestion[] {
  return [
    {
      title: t('onboarding.trustSecurityQ1'),
      answer: <>{t('onboarding.trustSecurityQ1Answer')}</>,
    },
    {
      title: t('onboarding.trustSecurityQ2'),
      answer: <>{t('onboarding.trustSecurityQ2Answer')}</>,
    },
    {
      title: t('onboarding.trustSecurityQ3'),
      answer: (
        <>
          {t('onboarding.trustSecurityQ3AnswerBefore')}{' '}
          <EvidenceLink href="https://security.rox.one">
            {t('onboarding.trustTrustCenter')}
          </EvidenceLink>{' '}
          {t('onboarding.trustSecurityQ3AnswerMiddle')}{' '}
          <EvidenceLink href="https://rox.one/dpa">
            {t('onboarding.trustDpa')}
          </EvidenceLink>{' '}
          {t('onboarding.trustSecurityQ3AnswerAfter')}
        </>
      ),
    },
    {
      title: t('onboarding.trustSecurityQ4'),
      answer: (
        <>
          {t('onboarding.trustSecurityQ4AnswerBefore')}{' '}
          <EvidenceLink href="https://github.com/macro-inc/macro">
            {t('onboarding.trustCodeOnGithub')}
          </EvidenceLink>
          {t('onboarding.trustSecurityQ4AnswerAfter')}
        </>
      ),
    },
  ];
}

/** Optional reading, grounded in Rox's privacy policy, DPA, and security material. */
export function OnboardingTrustDetails(props: {
  topic: 'security' | 'google';
  /**
   * The step also offers Microsoft: adds what Microsoft sign-in asks for and
   * the Outlook consent that follows it.
   */
  microsoft?: boolean;
  /** Fine print shown under the policy links, such as sign-up terms. */
  legal?: JSX.Element;
}) {
  const google = () => props.topic === 'google';
  const microsoft = () => google() && props.microsoft === true;
  const questions = () => {
    if (!google()) return securityQuestions();
    return microsoft()
      ? [...googleQuestions(), ...microsoftQuestions()]
      : googleQuestions();
  };

  return (
    <section class="mx-auto w-full max-w-[608px] px-6 pb-20 pt-20 font-[Inter_Variable] text-sm leading-7 text-ink-muted sm:pb-28 sm:pt-24 sm:text-[15px]">
      <div class="mb-10 h-px w-12 bg-edge" aria-hidden="true" />
      <p class="mb-4 text-xs text-ink-extra-muted">
        <Switch fallback={t('onboarding.trustSecurityAndPrivacy')}>
          <Match when={microsoft()}>
            {t('onboarding.trustGoogleOrMicrosoft')}
          </Match>
          <Match when={google()}>{t('onboarding.trustGoogleConnection')}</Match>
        </Switch>
      </p>
      <h2
        tabindex="-1"
        class="mb-7 text-2xl font-medium leading-8 tracking-tight text-ink outline-none sm:text-[28px] sm:leading-9"
      >
        {google()
          ? t('onboarding.trustEmailCalendarTitle')
          : t('onboarding.trustDataProtectionTitle')}
      </h2>
      <div class="space-y-5">
        <Show
          when={google()}
          fallback={
            <>
              <p>{t('onboarding.trustSecurityIntroOne')}</p>
              <p>{t('onboarding.trustSecurityIntroTwo')}</p>
              <p>{t('onboarding.trustSecurityIntroThree')}</p>
            </>
          }
        >
          <p>{t('onboarding.trustGoogleIntroOne')}</p>
          <p>{t('onboarding.trustGoogleIntroTwo')}</p>
          <p>{t('onboarding.trustGoogleIntroThree')}</p>
        </Show>
      </div>
      <Show when={microsoft()}>
        <h3 class="mb-3 mt-12 text-base font-medium text-ink">
          {t('onboarding.trustContinuingMicrosoft')}
        </h3>
        <div class="space-y-5">
          <p>{t('onboarding.trustMicrosoftIntroOne')}</p>
          <p>{t('onboarding.trustMicrosoftIntroTwo')}</p>
          <p>{t('onboarding.trustMicrosoftIntroThree')}</p>
        </div>
      </Show>
      <h3 class="mb-3 mt-12 text-base font-medium text-ink">
        {t('onboarding.trustFaq')}
      </h3>
      <div class="border-t border-edge-muted">
        <For each={questions()}>
          {(question) => (
            <details class="group border-b border-edge-muted">
              <summary class="flex list-none items-start justify-between gap-5 rounded-sm py-5 text-sm font-medium leading-6 text-ink-muted hover:text-ink focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
                {question.title}
                <CaretDownIcon
                  class="mt-1 size-4 shrink-0 text-ink-extra-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p class="pb-6 pr-6 font-normal">{question.answer}</p>
            </details>
          )}
        </For>
      </div>
      <p class="mt-8 text-xs leading-6 text-ink-extra-muted">
        {t('onboarding.trustMoreDetail')}{' '}
        <EvidenceLink href="https://rox.one/privacy/">
          {t('onboarding.trustPrivacyPolicy')}
        </EvidenceLink>{' '}
        {t('onboarding.trustAnd')}{' '}
        <EvidenceLink href="https://security.rox.one">
          {t('onboarding.trustTrustCenter')}
        </EvidenceLink>
        .
      </p>
      <Show when={props.legal}>
        <p class="mt-3 text-xs leading-6 text-ink-extra-muted">{props.legal}</p>
      </Show>
      <button
        type="button"
        class="mt-10 inline-flex items-center gap-2 rounded-sm py-2 text-sm text-ink-muted hover:text-ink focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink"
        onClick={(event) => {
          const scroller = event.currentTarget.closest(
            '[data-onboarding-scroll]'
          );
          scroller
            ?.querySelector<HTMLElement>('h1')
            ?.focus({ preventScroll: true });
          scroller?.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
              .matches
              ? 'instant'
              : 'smooth',
          });
        }}
      >
        {t('onboarding.trustBackToSetup')}{' '}
        <ArrowUpIcon class="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
