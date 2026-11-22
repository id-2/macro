import { ViewBreadcrumbs } from '@app/components/view-shell';
import { t } from '@app/lib/i18n';
import { isTouchDevice } from '@core/mobile/isTouchDevice';

export function HomeReturnBreadcrumb(props: { onReturn: () => void }) {
  return (
    <nav aria-label={`${t('nav.home')} location`} class="flex items-center gap-0.5">
      <ViewBreadcrumbs.ReturnButton
        data-allow-focus-in-preview
        onClick={props.onReturn}
      >
        {isTouchDevice() ? t('nav.notifications') : t('nav.home')}
      </ViewBreadcrumbs.ReturnButton>
      <ViewBreadcrumbs.Separator />
    </nav>
  );
}
