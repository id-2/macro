import { t } from '@app/lib/i18n';
import { PLAN_BY_TIER, type PlanTier } from '@app/features/paywall/plans';
import CaretRightIcon from '@icon/system/regular/caret-right.svg';
import CreditCardIcon from '@icon/system/regular/credit-card.svg';
import { Show } from 'solid-js';
import { IntegrationRow, SettingsCard } from '../primitives';

/** The current plan as a card that opens Billing settings. */
export function CurrentPlanCard(props: {
  /** Undefined while the plan is loading. */
  tier?: PlanTier;
  onOpen: () => void;
}) {
  return (
    <SettingsCard>
      <button
        type="button"
        class="w-full rounded-[inherit] text-left outline-none hover:bg-ink/4 focus-visible:bg-ink/6 focus-visible:inset-ring-2 focus-visible:inset-ring-accent"
        onClick={() => props.onOpen()}
      >
        <IntegrationRow
          icon={<CreditCardIcon />}
          title={
            <Show when={props.tier} fallback="Загружаю тариф…">
              {(tier) =>
                tier() === 'free'
                  ? t('settingsNav.freePlan')
                  : `Тариф «${PLAN_BY_TIER[tier()].name}»`
              }
            </Show>
          }
          description="Ваш тариф и данные об оплате"
        >
          <CaretRightIcon class="size-4 text-ink-extra-muted" />
        </IntegrationRow>
      </button>
    </SettingsCard>
  );
}
