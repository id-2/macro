import { t } from '@app/lib/i18n';
import XIcon from '@icon/system/regular/x.svg';
import { Button, Dialog, InputGroup, Surface, TextField } from '@ui';
import { Show } from 'solid-js';

export function AutoReloadDialog(props: {
  sharedWithTeam?: boolean;
  enabled: boolean;
  minimum: string;
  target: string;
  maximum: string;
  onMinimum: (value: string) => void;
  onTarget: (value: string) => void;
  onMaximum: (value: string) => void;
  onClose: () => void;
  onRestoreFocus?: () => void;
  onSave: () => void;
  onTurnOff: () => void;
  onPaymentMethods: () => void;
  canManagePaymentMethods: boolean;
  pending: boolean;
  paymentMethodsPending: boolean;
  disabled: boolean;
  invalid: boolean;
  notice?: string;
  error?: string;
}) {
  return (
    <Dialog
      open
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
      class="w-160"
    >
      <Surface depth={2} class="relative rounded-xl">
        <div class="flex max-h-[85dvh] flex-col gap-6 overflow-y-auto p-6">
          <Dialog.Title class="pr-8 text-xl font-semibold text-ink">
            {t('settingsUsage.autoReloadTitle')}
          </Dialog.Title>
          <Dialog.Description class="sr-only">
            {t('settingsUsage.autoReloadDescription')}
          </Dialog.Description>
          <Show when={props.sharedWithTeam}>
            <p class="text-sm text-ink-muted">
              {t('settingsUsage.autoReloadSharedNote')}
            </p>
          </Show>
          <TextField value={props.minimum} onChange={props.onMinimum}>
            <TextField.Label>
              {t('settingsUsage.minimumBalance')}
            </TextField.Label>
            <TextField.Description>
              {t('settingsUsage.minimumBalanceDescription')}
            </TextField.Description>
            <InputGroup size="xl">
              <TextField.Input
                as={InputGroup.Input}
                inputMode="decimal"
                class="text-sm"
              />
              <InputGroup.Addon aria-hidden="true">$</InputGroup.Addon>
            </InputGroup>
          </TextField>
          <TextField value={props.target} onChange={props.onTarget}>
            <TextField.Label>
              {t('settingsUsage.targetBalance')}
            </TextField.Label>
            <TextField.Description>
              {t('settingsUsage.targetBalanceDescription')}
            </TextField.Description>
            <InputGroup size="xl">
              <TextField.Input
                as={InputGroup.Input}
                inputMode="decimal"
                class="text-sm"
              />
              <InputGroup.Addon aria-hidden="true">$</InputGroup.Addon>
            </InputGroup>
          </TextField>
          <TextField value={props.maximum} onChange={props.onMaximum}>
            <TextField.Label>
              {t('settingsUsage.maximumSpend')}
            </TextField.Label>
            <TextField.Description>
              {t('settingsUsage.maximumSpendDescription')}
            </TextField.Description>
            <InputGroup size="xl">
              <TextField.Input
                as={InputGroup.Input}
                inputMode="decimal"
                class="text-sm"
                placeholder={t('settingsUsage.noLimit')}
              />
              <InputGroup.Addon aria-hidden="true">$</InputGroup.Addon>
            </InputGroup>
          </TextField>
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-ink">
              {t('settingsUsage.paymentMethod')}
            </h3>
            <p class="text-xs text-ink-muted">
              {t('settingsUsage.paymentMethodDescription')}
            </p>
            <Button
              class="self-start"
              variant="secondary"
              size="sm"
              disabled={
                !props.canManagePaymentMethods || props.paymentMethodsPending
              }
              onClick={props.onPaymentMethods}
            >
              {props.paymentMethodsPending
                ? t('settingsUsage.openingBillingPortal')
                : t('settingsUsage.managePaymentMethods')}
            </Button>
          </div>
          <div class="rounded-xl border border-edge-muted p-4">
            <h3 class="text-sm font-semibold text-ink">
              {t('settingsUsage.cardChargedTitle')}
            </h3>
            <p class="mt-2 text-sm text-ink-muted">
              {t('settingsUsage.cardChargedBody')}
            </p>
          </div>
          <Show when={props.notice}>
            <p class="text-xs text-ink-muted" role="status">
              {props.notice}
            </p>
          </Show>
          <Show when={props.error}>
            <p class="text-sm text-failure" role="alert">
              {props.error}
            </p>
          </Show>
          <div class="flex justify-end gap-2">
            <Show
              when={props.enabled}
              fallback={
                <Button variant="ghost" onClick={props.onClose}>
                  {t('settingsUsage.cancel')}
                </Button>
              }
            >
              <Button
                variant="ghost"
                disabled={props.disabled || props.pending}
                onClick={props.onTurnOff}
              >
                {t('settingsUsage.turnOff')}
              </Button>
            </Show>
            <Button
              variant="primary"
              disabled={props.disabled || props.pending || props.invalid}
              onClick={props.onSave}
            >
              {props.pending
                ? t('settingsUsage.saving')
                : props.enabled
                  ? t('settingsUsage.save')
                  : t('settingsUsage.turnOnAutoReload')}
            </Button>
          </div>
        </div>
        <Button
          aria-label={t('settingsUsage.closeAutoReload')}
          tooltip={t('settingsUsage.closeAutoReload')}
          class="absolute right-4 top-4"
          size="icon-sm"
          variant="ghost"
          onClick={props.onClose}
        >
          <XIcon class="size-4" />
        </Button>
      </Surface>
    </Dialog>
  );
}
