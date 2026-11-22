import { t } from '@app/lib/i18n';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Popover } from '@kobalte/core/popover';
import { Badge, badgeTriggerClasses, Tooltip } from '@ui';
import { type JSX, Show } from 'solid-js';

/** The explanation belongs to the chip; Restore is a separate focus target. */
export function RecordArchivedStatus(props: {
  kind: 'company' | 'contact';
  parentArchived?: boolean;
  children: JSX.Element;
}) {
  const explanation = () => {
    if (props.parentArchived)
      return t('crm.archivedWithCompany');
    if (props.kind === 'company')
      return t('crm.archivedCompanyExplanation');
    return t('crm.archivedContactExplanation');
  };
  return (
    <span
      class={`inline-flex min-w-0 flex-wrap items-center gap-x-2 mobile:basis-full ${props.kind === 'contact' ? 'mobile:pl-13' : 'mobile:pl-11'}`}
      data-crm-archived-status
    >
      <Show
        when={isTouchDevice()}
        fallback={
          <Tooltip.Root>
            <Tooltip.Trigger
              class={badgeTriggerClasses({ variant: 'outline', size: 'xs' })}
              aria-label={t('crm.archivedDetails')}
            >
              {t('crm.archived')}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content>
                <span class="max-w-72">{explanation()}</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        }
      >
        <Popover placement="bottom-start" gutter={6} modal={false}>
          <Popover.Trigger
            class={badgeTriggerClasses({
              variant: 'outline',
              size: 'xs',
              class:
                "touch:min-h-6 touch:min-w-11 touch:my-2.5 touch:before:absolute touch:before:-inset-x-px touch:before:top-1/2 touch:before:h-11 touch:before:-translate-y-1/2 touch:before:content-['']",
            })}
            aria-label={t('crm.archivedDetails')}
          >
            {t('crm.archived')}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class="menu-surface z-modal w-72 max-w-[calc(100vw-2rem)] p-3">
              <Popover.Title class="sr-only">{t('crm.archived')}</Popover.Title>
              <Popover.Description class="text-sm text-ink-muted">
                {explanation()}
              </Popover.Description>
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </Show>
      {props.children}
    </span>
  );
}

export function ArchivedRecordBadge() {
  return (
    <Badge variant="outline" size="xs">
      {t('crm.archived')}
    </Badge>
  );
}
