import { t } from '@app/lib/i18n';
import { Button, cn } from '@ui';
import { createSignal, Show } from 'solid-js';
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from '../../settings/primitives';
import { AutoReloadLimitNotice } from '../components/auto-reload-limit-notice';
import { MonthlyLimit } from '../components/monthly-limit';
import { UsageInfoDialog } from '../components/usage-info-dialog';
import type { UsageContext } from '../context/usage-context';
import { formatCreditBalance } from '../core/usage';
import { AutoReloadView } from './auto-reload';
import { CreditPurchaseView } from './credit-purchase';

export function UsageSettingsView(props: { context: UsageContext }) {
  const [infoOpen, setInfoOpen] = createSignal(false);
  const [purchaseOpen, setPurchaseOpen] = createSignal(false);
  const [autoReloadOpen, setAutoReloadOpen] = createSignal(false);
  // Controlled dialogs have no Dialog.Trigger; restore their actual opener on close.
  let infoTrigger: HTMLButtonElement | undefined;
  let purchaseTrigger: HTMLButtonElement | undefined;
  let autoReloadTrigger: HTMLButtonElement | undefined;
  const reloadLimit = () => {
    const budget = props.context.autoReload.budget?.();
    return props.context.autoReload.settings().enabled &&
      !props.context.autoReload.suspended() &&
      budget &&
      (budget.limitReached ?? budget.spentCents >= budget.limitCents)
      ? budget
      : undefined;
  };
  const autoReloadState = () =>
    props.context.autoReload.settings().enabled
      ? t('settingsUsage.reloadStateOn')
      : t('settingsUsage.reloadStateOff');
  const reloadLimitNotice = () => (
    <Show when={reloadLimit()}>
      {(budget) => (
        <AutoReloadLimitNotice
          budget={budget()}
          canManage={
            props.context.summary()?.billingAccess === 'payer' &&
            props.context.autoReload.available()
          }
          pending={
            props.context.autoReload.pending() ||
            props.context.creditPurchase.pending()
          }
          onAdjust={(trigger) => {
            autoReloadTrigger = trigger;
            setAutoReloadOpen(true);
          }}
          onAddCredits={(trigger) => {
            purchaseTrigger = trigger;
            setPurchaseOpen(true);
          }}
        />
      )}
    </Show>
  );
  return (
    <SettingsPage title={t('settingsNav.tabUsage')}>
      <Show when={!props.context.available()}>
        <SettingsCard>
          <div class="flex flex-col gap-2 p-6" role="status">
            <p class="font-medium text-ink">
              {t('settingsUsage.notAvailableTitle')}
            </p>
            <p class="text-sm text-ink-muted">
              {t('settingsUsage.notAvailableBody')}
            </p>
          </div>
        </SettingsCard>
      </Show>
      <fieldset
        disabled={!props.context.available()}
        class="flex min-w-0 flex-col gap-6"
        classList={{ 'opacity-50': !props.context.available() }}
      >
        <Show
          when={props.context.summary()}
          fallback={
            <SettingsCard>
              <div class="flex flex-col gap-3 p-6" role="status">
                <p class="text-sm text-ink-muted">
                  {props.context.failed()
                    ? t('settingsUsage.loadFailed')
                    : t('settingsUsage.loading')}
                </p>
                <Show when={props.context.failed()}>
                  <Button
                    class="self-start"
                    variant="secondary"
                    onClick={props.context.refresh}
                  >
                    {t('settingsUsage.tryAgain')}
                  </Button>
                </Show>
              </div>
            </SettingsCard>
          }
        >
          {(summary) => (
            <>
              <SettingsCard>
                <div class="p-6">
                  <MonthlyLimit
                    percentage={summary().monthlyPercent}
                    periodEnd={summary().periodEnd}
                    unlimited={summary().unlimited}
                    onInfo={() => setInfoOpen(true)}
                    infoButtonRef={(button) => {
                      infoTrigger = button;
                    }}
                  />
                  <Show
                    when={
                      summary().billingAccess === 'payer' &&
                      summary().creditScope === 'team' &&
                      !summary().unlimited
                    }
                  >
                    <p class="mt-3 text-xs text-ink-muted">
                      {t('settingsUsage.personalLimitNote')}
                    </p>
                  </Show>
                </div>
              </SettingsCard>
              <Show
                when={
                  summary().billingAccess === 'free' &&
                  !props.context.autoReload.preview()
                }
              >
                <SettingsCard>
                  <SettingsRow
                    label={t('settingsUsage.needMoreUsage')}
                    description={t('settingsUsage.subscribeForMore')}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={props.context.openPlans}
                    >
                      {t('settingsUsage.viewPlans')}
                    </Button>
                  </SettingsRow>
                </SettingsCard>
              </Show>
              <Show
                when={
                  (!summary().unlimited &&
                    summary().billingAccess !== 'free') ||
                  props.context.autoReload.preview()
                }
              >
                <SettingsSection
                  title={
                    summary().creditScope === 'team' &&
                    summary().billingAccess === 'payer'
                      ? t('settingsUsage.teamCredits')
                      : t('settingsUsage.usageCredits')
                  }
                  description={
                    summary().billingAccess === 'team-member'
                      ? undefined
                      : summary().creditScope === 'team'
                        ? t('settingsUsage.creditsSharedByTeam')
                        : t('settingsUsage.creditsExplainer')
                  }
                >
                  <Show
                    when={summary().billingAccess === 'team-member'}
                    fallback={
                      <>
                        {reloadLimitNotice()}
                        <SettingsCard>
                          <SettingsRow
                            label={
                              <span class="font-medium">
                                {t('settingsUsage.creditsRemaining', {
                                  amount: formatCreditBalance(
                                    summary().creditBalanceCents
                                  ),
                                })}
                              </span>
                            }
                            description={
                              summary().creditScope === 'team'
                                ? t('settingsUsage.sharedTeamBalance')
                                : t('settingsUsage.currentBalance')
                            }
                          >
                            <Show when={summary().billingAccess === 'payer'}>
                              <Button
                                ref={(button) => {
                                  purchaseTrigger = button;
                                }}
                                variant="secondary"
                                size="sm"
                                class="rounded-full px-4"
                                onClick={() => setPurchaseOpen(true)}
                              >
                                {t('settingsUsage.addMore')}
                              </Button>
                            </Show>
                          </SettingsRow>
                          <SettingsRow
                            label={t('settingsUsage.automaticReload')}
                            description={
                              props.context.autoReload.suspended() ? (
                                <span role="status" class="text-failure">
                                  {t('settingsUsage.pausedPaymentFailed')}
                                </span>
                              ) : summary().creditScope === 'team' ? (
                                t('settingsUsage.reloadsTeamCredits')
                              ) : undefined
                            }
                          >
                            <button
                              ref={(button) => {
                                autoReloadTrigger = button;
                              }}
                              type="button"
                              aria-label={t('settingsUsage.configureAutomaticReload')}
                              aria-haspopup="dialog"
                              aria-expanded={autoReloadOpen()}
                              class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
                              classList={{
                                'bg-accent':
                                  props.context.autoReload.settings().enabled,
                                'bg-ink-muted/40':
                                  !props.context.autoReload.settings().enabled,
                              }}
                              onClick={() => setAutoReloadOpen(true)}
                            >
                              <span
                                aria-hidden="true"
                                class={cn(
                                  'absolute left-0.5 size-4 rounded-full bg-surface transition-transform',
                                  props.context.autoReload.settings().enabled &&
                                    'translate-x-4'
                                )}
                              />
                              <span class="sr-only">
                                {props.context.autoReload.suspended()
                                  ? t('settingsUsage.reloadPausedStatus', {
                                      state: autoReloadState(),
                                    })
                                  : reloadLimit()
                                    ? t('settingsUsage.reloadLimitStatus', {
                                        state: autoReloadState(),
                                      })
                                    : t('settingsUsage.reloadCurrentStatus', {
                                        state: autoReloadState(),
                                      })}
                              </span>
                            </button>
                          </SettingsRow>
                        </SettingsCard>
                      </>
                    }
                  >
                    <SettingsCard>
                      <SettingsRow
                        label={
                          <span class="font-medium">
                            {t('settingsUsage.creditsRemaining', {
                              amount: formatCreditBalance(
                                summary().creditBalanceCents
                              ),
                            })}
                          </span>
                        }
                        description={
                          <Show
                            when={summary().purchaseLimit}
                            fallback={t('settingsUsage.sharedTeamBalance')}
                          >
                            {(limit) =>
                              t('settingsUsage.sharedWithLimit', {
                                remaining: formatCreditBalance(
                                  limit().remainingCents
                                ),
                                limit: formatCreditBalance(limit().limitCents),
                              })
                            }
                          </Show>
                        }
                      >
                        <Button
                          ref={(button) => {
                            purchaseTrigger = button;
                          }}
                          variant="secondary"
                          size="sm"
                          class="rounded-full px-4"
                          disabled={props.context.creditPurchase
                            .supportedAmounts()
                            .every(
                              (cents) =>
                                cents >
                                (summary().purchaseLimit?.remainingCents ??
                                  Number.POSITIVE_INFINITY)
                            )}
                          onClick={() => setPurchaseOpen(true)}
                        >
                          {t('settingsUsage.addMore')}
                        </Button>
                      </SettingsRow>
                    </SettingsCard>
                  </Show>
                </SettingsSection>
              </Show>
            </>
          )}
        </Show>
      </fieldset>
      <Show when={props.context.developer}>
        {(developer) => (
          <SettingsSection
            title={t('settingsUsage.developerTools')}
            description={t('settingsUsage.developerToolsDescription')}
          >
            <SettingsCard>
              <div class="flex flex-col gap-3 p-4">
                <Show when={developer().openBillingLab}>
                  {(open) => (
                    <Button
                      variant="primary"
                      size="sm"
                      class="self-start"
                      onClick={open()}
                    >
                      {t('settingsUsage.openBillingLab')}
                    </Button>
                  )}
                </Show>
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant={
                      developer().plan() === 'free' ? 'primary' : 'secondary'
                    }
                    size="sm"
                    aria-pressed={developer().plan() === 'free'}
                    onClick={() => developer().previewPlan('free')}
                  >
                    {t('settingsUsage.previewFreePlan')}
                  </Button>
                  <Button
                    variant={
                      developer().plan() === 'paid' ? 'primary' : 'secondary'
                    }
                    size="sm"
                    aria-pressed={developer().plan() === 'paid'}
                    onClick={() => developer().previewPlan('paid')}
                  >
                    {t('settingsUsage.previewPaidPlan')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={developer().beforeLaunch()}
                    onClick={() => developer().openLimitDialog('free')}
                  >
                    {t('settingsUsage.openFreeLimitDialog')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={developer().beforeLaunch()}
                    onClick={() => developer().openLimitDialog('paid')}
                  >
                    {t('settingsUsage.openPaidLimitDialog')}
                  </Button>
                  <Button
                    variant={
                      developer().beforeLaunch() ? 'primary' : 'secondary'
                    }
                    size="sm"
                    aria-pressed={developer().beforeLaunch()}
                    onClick={developer().previewBeforeLaunch}
                  >
                    {t('settingsUsage.previewBeforeLaunch')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!developer().active()}
                    onClick={developer().reset}
                  >
                    {t('settingsUsage.resetPreview')}
                  </Button>
                </div>
                <Show when={developer().active()}>
                  <p class="text-xs text-ink-muted" role="status">
                    {t('settingsUsage.developerActive')}
                  </p>
                </Show>
              </div>
            </SettingsCard>
          </SettingsSection>
        )}
      </Show>
      <Show when={props.context.available() && infoOpen()}>
        <UsageInfoDialog
          open={infoOpen()}
          onClose={() => setInfoOpen(false)}
          onRestoreFocus={() => infoTrigger?.focus()}
        />
      </Show>
      <Show when={props.context.available() && purchaseOpen()}>
        <CreditPurchaseView
          context={props.context}
          onClose={() => setPurchaseOpen(false)}
          onRestoreFocus={() => purchaseTrigger?.focus()}
        />
      </Show>
      <Show when={props.context.available() && autoReloadOpen()}>
        <AutoReloadView
          context={props.context}
          onClose={() => setAutoReloadOpen(false)}
          onRestoreFocus={() => autoReloadTrigger?.focus()}
        />
      </Show>
    </SettingsPage>
  );
}
