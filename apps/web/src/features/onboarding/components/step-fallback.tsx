import { t } from '@app/lib/i18n';
import { RoxMark } from '@core/component/RoxMark';

/** The quiet placeholder while a step's data is still on its way. */
export function StepFallback() {
  return (
    <div
      role="status"
      aria-label={t('onboarding.loadingSetup')}
      class="flex justify-center py-10"
    >
      <RoxMark class="size-6 animate-pulse" />
    </div>
  );
}
