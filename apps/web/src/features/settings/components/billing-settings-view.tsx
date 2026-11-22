import { type PaidPlanTier, PLAN_BY_TIER } from '@app/features/paywall/plans';
import CalendarIcon from '@icon/system/regular/calendar-blank.svg';
import EnvelopeIcon from '@icon/system/regular/envelope.svg';
import { Button, Layer } from '@ui';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import { type BillingState, describeSeatPlans } from '../core/billing-state';
import { SettingsCard, SettingsPage } from '../primitives';
import { BillingPlanCard, PlanFeatures } from './billing-plan-card';

function ruUsers(count: number): string {
  const n = Math.abs(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'пользователь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return 'пользователя';
  return 'пользователей';
}

export function BillingSettingsView(props: {
  state: BillingState;
  controls?: JSX.Element;
  renewalDate?: string;
  scheduledChange?: { plan: 'free' | 'premium' | 'max'; effectiveAt: string };
  subscriptionStatusFailed?: boolean;
  onRefreshStatus?: () => void;
  trialEligibilityFailed?: boolean;
  onRefreshTrialEligibility?: () => void;
  onKeepPlan?: (plan: PaidPlanTier) => void;
  teamSeatDescription?: string;
  onManage: () => void;
  onSelectPlan: (plan: PaidPlanTier) => void;
  onTeamSettings?: JSX.EventHandler<HTMLAnchorElement, MouseEvent>;
  /** The subscription breakdown, or the computers list when billing is unavailable. */
  computers?: JSX.Element;
}) {
  const formatDate = (value: string | undefined) => {
    if (!value) return;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  const scheduledChange = () => {
    const change = props.scheduledChange;
    const date = formatDate(change?.effectiveAt);
    return change && date ? { ...change, date } : undefined;
  };
  return (
    <SettingsPage
      title="Оплата"
      description={
        <>
          По вопросам оплаты{' '}
          <a
            class="text-link hover:text-link-hover visited:text-link-visited inline-flex items-center"
            href="mailto:support@rox.one"
          >
            напишите нам
            <EnvelopeIcon class="size-4 inline mx-1" />
          </a>
        </>
      }
    >
      {props.controls}
      <section
        data-settings-target="subscription"
        tabIndex={-1}
        class="flex scroll-mt-4 flex-col gap-4 outline-none"
      >
        <h2 class="text-base font-medium text-ink">Подписка</h2>
        <SettingsCard>
          <section class="flex flex-col gap-4 p-5">
            <header class="flex items-center gap-2">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-medium text-ink">
                    Тариф {PLAN_BY_TIER[props.state.tier].name}
                  </h3>

                  <Layer depth={3}>
                    <span class="text-xs text-ink-muted px-1.5 py-0.25 border border-edge-muted rounded-md bg-active">
                      Текущий
                    </span>
                  </Layer>
                </div>
                <Switch>
                  <Match
                    when={
                      props.state.teamRole === 'member' &&
                      props.state.billedThroughTeam
                    }
                  >
                    <p class="text-ink-extra-muted text-xs">
                      Ваше место оплачивается через команду. Администраторы
                      команды выбирают тариф каждого места в{' '}
                      <a
                        class="text-link hover:text-link-hover"
                        href="/app/settings/team-members"
                        onClick={props.onTeamSettings}
                      >
                        настройках команды
                      </a>
                      .
                    </p>
                  </Match>
                  <Match
                    when={
                      props.state.hasPaid &&
                      props.state.teamRole === 'owner' &&
                      (props.teamSeatDescription || props.state.teamPlans)
                    }
                  >
                    <p class="text-ink-extra-muted text-xs">
                      {props.teamSeatDescription ||
                        `${props.state.teamPlans?.length} ${ruUsers(props.state.teamPlans?.length ?? 0)} • ${describeSeatPlans(props.state.teamPlans ?? [])}`}{' '}
                      • тариф каждого места задаётся в{' '}
                      <a
                        class="text-link hover:text-link-hover"
                        href="/app/settings/team-members"
                        onClick={props.onTeamSettings}
                      >
                        настройках команды
                      </a>
                    </p>
                  </Match>
                </Switch>
                <Show
                  when={props.state.hasPaid && formatDate(props.renewalDate)}
                >
                  {(date) => (
                    <p class="text-xs text-ink-extra-muted">
                      {scheduledChange()?.plan === 'free'
                        ? 'Подписка заканчивается '
                        : 'Текущий расчётный период заканчивается '}
                      {date()}.
                    </p>
                  )}
                </Show>
              </div>

              <Show
                when={
                  props.state.canManageBilling &&
                  (props.state.hasPaid || props.state.existingSubscription)
                }
              >
                <Button
                  class="ml-auto bg-active"
                  size="sm"
                  variant="secondary"
                  onClick={props.onManage}
                >
                  Управлять
                </Button>
              </Show>
            </header>
            <Show
              when={
                props.state.canManageBilling &&
                props.state.existingSubscription &&
                !props.state.hasPaid
              }
            >
              <p role="status" class="text-sm text-ink-muted">
                У вас уже есть подписка. Нажмите «Управлять», чтобы проверить
                подписку и платёжные данные.
              </p>
            </Show>
            <ul class="border-t border-t-edge-muted pt-4 flex flex-wrap gap-4 text-sm text-ink-muted">
              <PlanFeatures
                tier={props.state.tier}
                aiUsageEnabled={props.state.aiUsageEnabled}
              />
            </ul>
          </section>
        </SettingsCard>
        <Show when={props.subscriptionStatusFailed}>
          <div
            class="flex flex-wrap items-center gap-3 px-4 text-xs text-ink-muted"
            role="status"
          >
            <p>Не удалось загрузить сведения о продлении.</p>
            <Button variant="ghost" size="sm" onClick={props.onRefreshStatus}>
              Повторить
            </Button>
          </div>
        </Show>
        <Show when={scheduledChange()}>
          {(change) => (
            <SettingsCard>
              <div class="flex flex-wrap items-center gap-3 p-4" role="status">
                <CalendarIcon class="size-4 shrink-0 text-ink-muted" />
                <p class="min-w-0 flex-1 text-sm text-ink">
                  {change().plan === 'free'
                    ? `Отмена подписки запланирована на ${change().date}.`
                    : `Переход на тариф ${PLAN_BY_TIER[change().plan].name} запланирован на ${change().date}.`}
                </p>
                <Show
                  when={
                    props.state.canChangePlan && props.state.tier !== 'free'
                  }
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={props.state.pending}
                    onClick={() => {
                      const tier = props.state.tier;
                      if (tier !== 'free') props.onKeepPlan?.(tier);
                    }}
                  >
                    Оставить тариф {PLAN_BY_TIER[props.state.tier].name}
                  </Button>
                </Show>
              </div>
            </SettingsCard>
          )}
        </Show>
      </section>

      {props.computers}

      <Show
        when={
          props.state.canChangePlan &&
          props.state.tier !== 'max' &&
          (props.state.hasPaid || !props.state.existingSubscription)
        }
      >
        <section
          data-settings-target="upgrade"
          tabIndex={-1}
          class="@container/plan-options flex scroll-mt-4 flex-col gap-4 outline-none"
        >
          <h2 class="text-base font-medium text-ink">
            {props.state.hasPaid && props.state.aiUsageEnabled
              ? 'Нужно больше ИИ?'
              : 'Улучшить тариф'}
          </h2>
          <Show when={props.trialEligibilityFailed}>
            <div
              role="alert"
              class="flex flex-wrap items-center gap-3 text-sm text-ink-muted"
            >
              <p>Не удалось подтвердить предложение Pro. Попробуйте ещё раз.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={props.onRefreshTrialEligibility}
              >
                Повторить
              </Button>
            </div>
          </Show>
          <div
            class="grid grid-cols-1 gap-6"
            classList={{
              '@2xl/plan-options:grid-cols-2': !props.state.hasPaid,
            }}
          >
            <For
              each={(['premium', 'max'] as const).filter(
                (plan) => !props.state.hasPaid || plan !== props.state.tier
              )}
            >
              {(plan) => (
                <BillingPlanCard
                  plan={plan}
                  state={props.state}
                  onSelectPlan={props.onSelectPlan}
                />
              )}
            </For>
          </div>
        </section>
      </Show>
    </SettingsPage>
  );
}
