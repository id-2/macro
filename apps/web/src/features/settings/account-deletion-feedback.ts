import type {
  AccountDeletionReason,
  AppEvents,
} from '@app/lib/analytics/app-events';
import type { TranslationKey } from '@app/lib/i18n';

export const ACCOUNT_DELETION_FEEDBACK_MAX_LENGTH = 500;

export const ACCOUNT_DELETION_REASON_OPTIONS: ReadonlyArray<{
  value: AccountDeletionReason;
  label: TranslationKey;
}> = [
  {
    value: 'not_using_enough',
    label: 'settingsAccount.deletionReasons.notUsingEnough',
  },
  {
    value: 'missing_features',
    label: 'settingsAccount.deletionReasons.missingFeatures',
  },
  {
    value: 'difficult_to_use',
    label: 'settingsAccount.deletionReasons.difficultToUse',
  },
  {
    value: 'bugs_or_performance',
    label: 'settingsAccount.deletionReasons.bugsOrPerformance',
  },
  { value: 'too_expensive', label: 'settingsAccount.deletionReasons.tooExpensive' },
  {
    value: 'prefer_another_product',
    label: 'settingsAccount.deletionReasons.preferAnotherProduct',
  },
  {
    value: 'privacy_or_security_concerns',
    label: 'settingsAccount.deletionReasons.privacyOrSecurity',
  },
  { value: 'other', label: 'settingsAccount.deletionReasons.other' },
];

export function buildAccountDeletionFeedbackPayload(
  reason: AccountDeletionReason | undefined,
  feedback: string
): AppEvents['account_deletion_feedback'] {
  const normalizedFeedback = feedback
    .trim()
    .slice(0, ACCOUNT_DELETION_FEEDBACK_MAX_LENGTH);

  return {
    reason: reason ?? 'not_provided',
    ...(normalizedFeedback ? { feedback: normalizedFeedback } : {}),
  };
}

export async function performAccountDeletion(dependencies: {
  captureFeedback: () => void;
  deleteUser: () => Promise<{ isErr: () => boolean }>;
  logout: () => Promise<void>;
}): Promise<boolean> {
  dependencies.captureFeedback();

  const result = await dependencies.deleteUser();
  if (result.isErr()) return false;

  await dependencies.logout();
  return true;
}
