export const ONBOARDING_STEPS = [
  'welcome',
  'vision',
  'security',
  'handle',
  'work',
  'personal',
  'tools',
  'team',
  'plan',
  'routines',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** How the user left a step; analytics records it and skipping can fork. */
export type StepOutcome = 'completed' | 'skipped';

/** The opening slides that share the story stage's measured handoffs. */
export type StoryStep = Extract<
  OnboardingStep,
  'welcome' | 'vision' | 'security' | 'tools'
>;

export const isStoryStep = (step: OnboardingStep): step is StoryStep =>
  step === 'welcome' ||
  step === 'vision' ||
  step === 'security' ||
  step === 'tools';

/** Trust proof, the intro slides, inbox import and the routine picker are not shown. */
const HIDDEN_STEPS: Record<
  'security' | 'work' | 'personal' | 'welcome' | 'vision' | 'tools',
  true
> = {
  security: true,
  work: true,
  personal: true,
  welcome: true,
  vision: true,
  tools: true,
};

function stepAfter(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)];
}

/** The first step a person can actually open, skipping trust and inbox import. */
export function visibleOnboardingStep(step: OnboardingStep): OnboardingStep {
  let current = step;
  while (current in HIDDEN_STEPS) {
    const next = stepAfter(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

export function nextOnboardingStep(
  step: OnboardingStep,
  outcome: StepOutcome
): OnboardingStep {
  // Without a first account, offering a second account would be misleading.
  // Both inbox steps are hidden, so either way the flow continues at tools.
  if (step === 'work' && outcome === 'skipped') return 'tools';
  return visibleOnboardingStep(stepAfter(step));
}

export function previousOnboardingStep(
  step: OnboardingStep
): OnboardingStep | undefined {
  let index = ONBOARDING_STEPS.indexOf(step);
  while (index > 0) {
    index -= 1;
    const previous = ONBOARDING_STEPS[index];
    if (!(previous in HIDDEN_STEPS)) return previous;
  }
  return undefined;
}

/** A `?step` value that names a current onboarding step. */
export function parseOnboardingStepParam(
  value: unknown
): OnboardingStep | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  return ONBOARDING_STEPS.find((step) => step === raw);
}

/**
 * Where to open the flow.
 * Checkout return, then saved progress (including legacy names), then a
 * `?step` link, then welcome. Trust and inbox import never open.
 */
export function restoreOnboardingStep(
  saved: unknown,
  checkoutReturn = false,
  requestedStep?: unknown
): OnboardingStep {
  if (checkoutReturn) return 'plan';
  const resumed = resumeSavedStep(saved);
  if (resumed) return visibleOnboardingStep(resumed);
  return visibleOnboardingStep(
    parseOnboardingStepParam(requestedStep) ?? 'welcome'
  );
}

/** Migrate in-progress sessions from the previous flow without losing OAuth returns. */
function resumeSavedStep(saved: unknown): OnboardingStep | undefined {
  if (typeof saved !== 'string') return undefined;
  if (saved === 'email') return 'handle';
  if (saved.startsWith('connect-')) return 'tools';
  if (saved === 'building' || saved === 'summary') return 'plan';
  return ONBOARDING_STEPS.find((step) => step === saved);
}
