import { t } from '@app/lib/i18n';
import XIcon from '@icon/system/regular/x.svg';
import { Button, Dialog, Surface } from '@ui';

export function UsageInfoDialog(props: {
  open: boolean;
  onClose: () => void;
  onRestoreFocus?: () => void;
}) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      onCloseAutoFocus={
        props.onRestoreFocus
          ? (event) => {
              event.preventDefault();
              props.onRestoreFocus?.();
            }
          : undefined
      }
      position="center"
      class="w-120"
    >
      <Surface depth={2} class="rounded-xl p-6">
        <div class="flex items-start justify-between gap-4">
          <Dialog.Title class="text-xl font-semibold text-ink">
            {t('settingsUsage.monthlyLimit')}
          </Dialog.Title>
          <Button
            aria-label={t('settingsUsage.closeUsageExplanation')}
            tooltip={t('settingsUsage.closeUsageExplanation')}
            size="icon-sm"
            variant="ghost"
            onClick={props.onClose}
          >
            <XIcon class="size-4" />
          </Button>
        </div>
        <Dialog.Description class="mt-3 text-sm text-ink-muted">
          {t('settingsUsage.monthlyLimitExplanation')}
        </Dialog.Description>
        <p class="mt-3 text-sm text-ink-muted">
          {t('settingsUsage.monthlyLimitDetail')}
        </p>
      </Surface>
    </Dialog>
  );
}
