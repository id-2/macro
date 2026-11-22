import { ViewSkeleton } from '@app/components/view-shell/ViewSkeleton';
import { formatLocale } from '@app/lib/i18n';
import { CalendarGridSkeleton } from '@app/features/calendar/components/CalendarGridSkeleton';

const monthTitle = () =>
  new Intl.DateTimeFormat(formatLocale(), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

/** Calendar while its code loads: the month title over an empty week grid. */
export function CalendarViewSkeleton() {
  return (
    <ViewSkeleton.Root
      asidePreferenceKey="calendar"
      aside={{ preserveDuringResize: false }}
    >
      <ViewSkeleton.Sidebar title="Календарь" createLabel="Создать календарь Rox" />
      <ViewSkeleton.Main
        title={monthTitle()}
        controls={['Ссылки для записи ⌄', 'Сегодня ‹ ›', 'Неделя ⌄', '+ New ⌄', 1]}
      >
        <div class="flex min-h-0 flex-1">
          <CalendarGridSkeleton dayCount={7} showDayHeader showAllDaySlot />
        </div>
      </ViewSkeleton.Main>
    </ViewSkeleton.Root>
  );
}
