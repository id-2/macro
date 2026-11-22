import { t } from '@app/lib/i18n';
import XIcon from '@icon/system/regular/x.svg';
import { Button, Dialog, InputGroup, Surface } from '@ui';
import { createUniqueId, For, Show } from 'solid-js';
import { formatCreditBalance } from '../core/usage';

export function CreditPurchaseDialog(props: {
  sharedWithTeam?: boolean;
  /** A team member buying on the team owner's card. */
  teamCard?: boolean;
  selection: number | 'other';
  customAmount: string;
  amountCents: number | undefined;
  onSelect: (amount: number | 'other') => void;
  onCustomAmount: (amount: string) => void;
  onClose: () => void;
  onRestoreFocus?: () => void;
  onBuy: () => void;
  onViewPlans?: () => void;
  pending: boolean;
  disabled: boolean;
  notice?: string;
  error?: string;
}) {
  const name = createUniqueId();
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
      class="w-180"
    >
      <Surface depth={2} class="relative rounded-xl">
        <div class="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-6">
          <header class="pr-8">
            <Dialog.Title class="text-xl font-semibold text-ink">
              {t('settingsUsage.needMoreUsageTitle')}
            </Dialog.Title>
            <Dialog.Description class="mt-1 text-sm text-ink-muted">
              {props.sharedWithTeam
                ? t('settingsUsage.creditsSharedShort')
                : t('settingsUsage.chooseAmount')}
            </Dialog.Description>
          </header>
          <fieldset class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <legend class="sr-only">
              {t('settingsUsage.creditAmount')}
            </legend>
            <For each={[2_500, 5_000, 10_000, 'other'] as const}>
              {(amount) => (
                <label class="relative flex min-h-22 items-start rounded-xl border border-edge-muted p-4 has-checked:border-accent has-checked:ring-1 has-checked:ring-accent focus-within:ring-2 focus-within:ring-accent">
                  <input
                    class="sr-only"
                    type="radio"
                    name={name}
                    value={amount}
                    checked={props.selection === amount}
                    onChange={() => props.onSelect(amount)}
                  />
                  <span class="text-base font-semibold text-ink">
                    {amount === 'other'
                      ? t('settingsUsage.other')
                      : formatCreditBalance(amount)}
                  </span>
                </label>
              )}
            </For>
          </fieldset>
          <Show when={props.selection === 'other'}>
            <InputGroup size="xl">
              <InputGroup.Input
                aria-label={t('settingsUsage.customAmountLabel')}
                inputMode="decimal"
                class="text-sm"
                placeholder={t('settingsUsage.enterAmount')}
                value={props.customAmount}
                onInput={(event) =>
                  props.onCustomAmount(event.currentTarget.value)
                }
              />
              <InputGroup.Addon aria-hidden="true">$</InputGroup.Addon>
            </InputGroup>
          </Show>
          <div class="rounded-xl border border-edge-muted p-4 text-sm text-ink">
            <div class="flex justify-between gap-4">
              <span>
                {props.sharedWithTeam
                  ? t('settingsUsage.teamUsageCredits')
                  : t('settingsUsage.usageCredits')}
              </span>
              <span>{formatCreditBalance(props.amountCents ?? 0)}</span>
            </div>
            <div class="mt-4 flex justify-between gap-4 border-t border-edge-muted pt-4">
              <span>{t('settingsUsage.total')}</span>
              <span class="font-semibold">
                {formatCreditBalance(props.amountCents ?? 0)}
              </span>
            </div>
          </div>
          <p class="text-xs text-ink-muted">
            {props.teamCard
              ? t('settingsUsage.chargedToTeamCard')
              : t('settingsUsage.chargedToOwnCard')}
          </p>
          <Show when={props.notice}>
            <p class="text-sm text-ink-muted" role="status">
              {props.notice}
            </p>
          </Show>
          <Show when={props.error}>
            <p class="text-sm text-failure" role="alert">
              {props.error}
            </p>
          </Show>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={props.onClose}>
              {t('settingsUsage.cancel')}
            </Button>
            <Show
              when={props.onViewPlans}
              fallback={
                <Button
                  variant="primary"
                  disabled={props.disabled || props.pending}
                  onClick={props.onBuy}
                >
                  {props.pending
                    ? t('settingsUsage.charging')
                    : t('settingsUsage.buyCredits', {
                        amount: formatCreditBalance(props.amountCents ?? 0),
                      })}
                </Button>
              }
            >
              {(viewPlans) => (
                <Button variant="primary" onClick={viewPlans()}>
                  {t('settingsUsage.viewPlans')}
                </Button>
              )}
            </Show>
          </div>
        </div>
        <Button
          aria-label={t('settingsUsage.closeCreditPurchase')}
          tooltip={t('settingsUsage.closeCreditPurchase')}
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
