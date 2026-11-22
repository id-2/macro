import { formatLocale, t } from '@app/lib/i18n';
import InfoIcon from '@icon/system/regular/info.svg';
import { Button, cn } from '@ui';
import { Show } from 'solid-js';

export function MonthlyLimit(props: {
  percentage: number;
  periodEnd: string;
  unlimited?: boolean;
  onInfo?: () => void;
  infoButtonRef?: (button: HTMLButtonElement) => void;
}) {
  const resetDate = () => {
    const date = new Date(props.periodEnd);
    return Number.isNaN(date.getTime())
      ? undefined
      : date.toLocaleDateString(formatLocale(), {
          month: 'short',
          day: 'numeric',
        });
  };
  const percentageLabel = () => `${Math.round(props.percentage)}%`;
  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-1.5">
          <h2 class="text-sm font-medium text-ink">
            {t('settingsUsage.monthlyLimit')}
          </h2>
          <Show when={props.onInfo}>
            <Button
              aria-label={t('settingsUsage.aboutMonthlyUsage')}
              tooltip={t('settingsUsage.aboutMonthlyUsage')}
              ref={props.infoButtonRef}
              size="icon-sm"
              variant="ghost"
              onClick={props.onInfo}
            >
              <InfoIcon class="size-4 text-ink-muted" />
            </Button>
          </Show>
        </div>
        <span class="text-sm font-medium text-ink">
          {props.unlimited
            ? t('settingsUsage.unlimited')
            : t('settingsUsage.percentUsed', { percent: percentageLabel() })}
        </span>
      </div>
      <Show when={!props.unlimited}>
        <div
          role="progressbar"
          aria-label={t('settingsUsage.monthlyLimit')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={props.percentage}
          aria-valuetext={t('settingsUsage.percentUsed', {
            percent: percentageLabel(),
          })}
          class="h-2 w-full overflow-hidden rounded-full bg-active"
        >
          <div
            class={cn(
              'h-full rounded-full transition-[width]',
              props.percentage >= 100 ? 'bg-failure' : 'bg-accent'
            )}
            style={{ width: `${props.percentage}%` }}
          />
        </div>
      </Show>
      <Show when={resetDate()}>
        <p class="text-xs text-ink-muted">
          {t('settingsUsage.resetsOn', { date: resetDate() ?? '' })}
        </p>
      </Show>
    </div>
  );
}
