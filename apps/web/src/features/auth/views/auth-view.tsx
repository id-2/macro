import { fireAndForget } from '@core/util/fireAndForget';
import { Stepper } from '@ui/components/Stepper';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import { AddressForm } from '../components/address-form';
import { EmailForm } from '../components/email-form';
import { LoginCard } from '../components/login-card';
import { LoginPicker } from '../components/login-picker';
import { PasskeyForm } from '../components/passkey-form';
import { VerifyForm } from '../components/verify-form';
import {
  type AuthIntent,
  type AuthUser,
  useAuthContext,
} from '../context/auth-context';
import {
  createEmailLogin,
  type EmailLogin,
  type LoginStep,
} from '../primitives/email-login';
import {
  createSessionIdentity,
  redeemSessionToken,
} from '../primitives/session';

/** What desktop sign-up hands onboarding's opening slides. */
export type SignupJourneySlots = {
  onGoogle: () => Promise<void>;
  /** Absent while Microsoft sign-up is off. */
  onMicrosoft?: () => Promise<void>;
  onBackFromEmail: () => void;
  onSignIn: () => void;
  onAgentSignup: () => void;
  emailForm: JSX.Element;
  showingEmail: boolean;
};

/** Sign-in and sign-up by an emailed code, then whatever comes next. */
export function AuthView(props: {
  intent: AuthIntent;
  /** No provider buttons: the entry opens on the email form. */
  emailOnly?: boolean;
  showApple: boolean;
  /** The header yields to the on-screen keyboard on phones. */
  compact: boolean;
  initialEmail?: string;
  autoStart?: boolean;
  /** Why a provider sign-in just failed; the email step opens instead. */
  ssoFallbackNotice?: string;
  /** The session code an SSO return put on the URL. */
  token?: string;
  onVerified?: () => void;
  /** Desktop sign-up: onboarding's slides host Google and the email form. */
  signupJourney?: (slots: SignupJourneySlots) => JSX.Element;
  /** Switches a returning visitor from sign-up to sign-in. */
  onSignIn?: () => void;
  /** Switches an agent from sign-up to the agent signup page. */
  onAgentSignup?: () => void;
  /**
   * Shown while the session is still resolving on a cold load, instead of the
   * signed-out screens a returning visitor would otherwise see flash by.
   */
  pending?: () => JSX.Element;
  /** What a signed-in visitor sees instead. */
  signedIn: (user: Accessor<AuthUser>) => JSX.Element;
}) {
  const context = useAuthContext();
  const login = createEmailLogin(context, {
    intent: props.intent,
    initialEmail: props.initialEmail,
    autoStart: props.autoStart,
    startAtEmail: props.emailOnly,
    onVerified: props.onVerified,
    fallbackNotice: props.ssoFallbackNotice,
  });
  createSessionIdentity(context);
  redeemSessionToken(context, () => props.token);
  onMount(() => context.pageView(props.intent));

  /*
   * The address step stays put while its button shows the accepted check: the
   * claim itself advances `login.step()` straight away, so the stepper is fed
   * a held index until the mark has been read.
   */
  const CLAIM_CHECK_MS = 420;
  const [holding, setHolding] = createSignal(false);
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  const releaseHold = () => {
    clearTimeout(holdTimer);
    holdTimer = undefined;
    setHolding(false);
  };
  const holdAddress = () => {
    clearTimeout(holdTimer);
    holdTimer = undefined;
    setHolding(true);
  };
  const releaseAfterCheck = () => {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(releaseHold, CLAIM_CHECK_MS);
  };
  onCleanup(() => clearTimeout(holdTimer));
  const backFromAddress = () => {
    releaseHold();
    login.back();
  };
  /** The step the stepper shows, which lags the login's own while held. */
  const heldStep = (map: Record<LoginStep, number>) =>
    holding() ? Math.min(map[login.step()], map.address) : map[login.step()];

  const user = () => {
    const session = context.session();
    return session.t === 'signed-in' ? session.user : undefined;
  };

  const signedOut = () => (
    <Switch>
      <Match when={props.signupJourney}>
        {(journey) =>
          journey()({
            onGoogle: () => Promise.resolve(),
            onMicrosoft: undefined,
            onBackFromEmail: login.back,
            onSignIn: () => props.onSignIn?.(),
            onAgentSignup: () => props.onAgentSignup?.(),
            showingEmail: login.step() !== 'choose',
            emailForm: (
              <Show when={login.step() !== 'choose'}>
                <Stepper
                  step={heldStep(JOURNEY_STEP)}
                  transition={Stepper.transitions.scale}
                >
                  <Stepper.Step>
                    <EmailStep login={login} />
                  </Stepper.Step>
                  <Stepper.Step>
                    <AddressStep
                      login={login}
                      onHold={holdAddress}
                      onClaimed={releaseAfterCheck}
                      onBack={backFromAddress}
                    />
                  </Stepper.Step>
                  <Stepper.Step>
                    <VerifyStep login={login} />
                  </Stepper.Step>
                  <Stepper.Step>
                    <PasskeyStep login={login} />
                  </Stepper.Step>
                </Stepper>
              </Show>
            ),
          })
        }
      </Match>
      <Match when={true}>
        <LoginCard
          compact={props.compact}
          agentSignup={props.intent === 'agent-signup'}
          hideHeader={heldStep(STEP_INDEX) === STEP_INDEX.address}
        >
          <Stepper
            step={heldStep(STEP_INDEX)}
            transition={Stepper.transitions.scale}
          >
            <Stepper.Step>
              <LoginPicker
                showApple={props.showApple}
                onApple={() =>
                  fireAndForget(context.startSso('apple', props.intent), 'auth')
                }
                onEmail={login.chooseEmail}
              />
            </Stepper.Step>
            <Stepper.Step>
              <EmailStep login={login} showBack={!props.emailOnly} />
            </Stepper.Step>
            <Stepper.Step>
              <AddressStep
                login={login}
                onHold={holdAddress}
                onClaimed={releaseAfterCheck}
                onBack={backFromAddress}
              />
            </Stepper.Step>
            <Stepper.Step>
              <VerifyStep login={login} />
            </Stepper.Step>
            <Stepper.Step>
              <PasskeyStep login={login} />
            </Stepper.Step>
          </Stepper>
        </LoginCard>
      </Match>
    </Switch>
  );

  return (
    <Show when={context.session().t !== 'loading'} fallback={props.pending?.()}>
      <Show when={user()} fallback={signedOut()}>
        {(signedIn) => (
          // Refreshes update the existing workspace; only changing accounts
          // should remount it and restart its pending work.
          <Show when={signedIn().id} keyed>
            {(_id) => props.signedIn(signedIn)}
          </Show>
        )}
      </Show>
    </Show>
  );
}

const STEP_INDEX = {
  choose: 0,
  email: 1,
  address: 2,
  verify: 3,
  passkey: 4,
} as const satisfies Record<LoginStep, number>;

const JOURNEY_STEP = {
  choose: 0,
  email: 0,
  address: 1,
  verify: 2,
  passkey: 3,
} as const satisfies Record<LoginStep, number>;

function EmailStep(props: { login: EmailLogin; showBack?: boolean }) {
  return (
    <EmailForm
      email={props.login.email()}
      password={props.login.password()}
      passwordRequired={props.login.passwordRequired()}
      sending={props.login.sending()}
      error={props.login.sendError()}
      onEmailInput={props.login.setEmail}
      onPasswordInput={props.login.setPassword}
      onSubmit={props.login.submitEmail}
      onBack={props.showBack === false ? undefined : props.login.back}
    />
  );
}

function AddressStep(props: {
  login: EmailLogin;
  /** Keeps the step on screen from the click until the address is accepted. */
  onHold: () => void;
  /** The address was accepted: hold it long enough to show the check. */
  onClaimed: () => void;
  onBack: () => void;
}) {
  const claimed = () =>
    props.login.createdAccount() && props.login.step() !== 'address';
  createEffect(() => {
    if (claimed()) props.onClaimed();
  });
  return (
    <AddressForm
      local={props.login.handle()}
      sending={props.login.sending()}
      claimed={claimed()}
      error={props.login.sendError()}
      onLocalInput={props.login.setHandle}
      onSubmit={() => {
        props.onHold();
        props.login.submitAddress();
      }}
      onBack={props.onBack}
    />
  );
}

function PasskeyStep(props: { login: EmailLogin }) {
  return (
    <PasskeyForm
      mode={props.login.passkeyKind()}
      busy={props.login.passkeyBusy()}
      error={props.login.passkeyError()}
      onSubmit={props.login.submitPasskey}
      onBack={props.login.back}
    />
  );
}

function VerifyStep(props: { login: EmailLogin }) {
  return (
    <VerifyForm
      email={props.login.email()}
      code={props.login.code()}
      verifying={props.login.verifying()}
      canVerify={props.login.canVerify()}
      resendIn={props.login.resendIn()}
      resending={props.login.sending()}
      error={props.login.verifyError() ?? props.login.sendError()}
      onCodeInput={props.login.setCode}
      onVerify={props.login.verify}
      onResend={() => fireAndForget(props.login.resend(), 'auth')}
      onBack={props.login.back}
    />
  );
}
