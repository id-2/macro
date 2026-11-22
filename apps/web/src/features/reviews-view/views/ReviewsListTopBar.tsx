import {
  useViewShell,
  ViewBreadcrumbs,
  ViewShell,
} from '@app/components/view-shell';
import { t } from '@app/lib/i18n';
import { Show } from 'solid-js';

/** Keep the workspace name visible when navigation no longer names the view. */
export function ReviewsListTopBar() {
  const shell = useViewShell();
  const compact = () =>
    shell.breakpoints.narrow?.() || shell.aside.isCollapsed();

  return (
    <ViewShell.TopBar>
      <Show
        when={compact()}
        fallback={<ViewBreadcrumbs.Outlet aria-label={t('reviews.reviewLocation')} />}
      >
        <h1 class="min-w-0 truncate text-sm font-semibold text-ink">
          {t('reviews.title')}
        </h1>
      </Show>
    </ViewShell.TopBar>
  );
}
