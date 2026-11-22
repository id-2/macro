import { t } from '@app/lib/i18n';

/** Feature comparison shown below the unchanged trial offer. */
export function planComparison() {
  return [
    {
      feature: t('onboarding.planRowAiUsage'),
      values: {
        free: t('onboarding.planUsageLimited'),
        premium: t('onboarding.planUsageStandard'),
        max: t('onboarding.planUsageMax'),
      },
    },
    {
      feature: t('onboarding.planRowAccounts'),
      values: {
        free: t('onboarding.planUpTo2'),
        premium: t('onboarding.planUnlimited'),
        max: t('onboarding.planUnlimited'),
      },
    },
    {
      feature: t('onboarding.planRowBranding'),
      values: {
        free: t('onboarding.planSentWithRox'),
        premium: t('onboarding.planNoWatermark'),
        max: t('onboarding.planNoWatermark'),
      },
    },
    {
      feature: t('onboarding.planRowModels'),
      values: {
        free: 'Gemini Flash',
        premium: t('onboarding.planAllModels'),
        max: t('onboarding.planAllModels'),
      },
    },
    {
      feature: t('onboarding.planRowStorage'),
      values: {
        free: t('onboarding.planSize5gb'),
        premium: t('onboarding.planSize100gb'),
        max: t('onboarding.planSize1tb'),
      },
    },
    {
      feature: t('onboarding.planRowCalls'),
      values: {
        free: t('onboarding.planNotIncluded'),
        premium: t('onboarding.planIncludedValue'),
        max: t('onboarding.planIncludedValue'),
      },
    },
  ] as const;
}
