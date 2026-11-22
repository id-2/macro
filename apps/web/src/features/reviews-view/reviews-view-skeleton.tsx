import { ViewSkeleton } from '@app/components/view-shell/ViewSkeleton';
import { t } from '@app/lib/i18n';

/** Reviews while its code loads: the scopes sidebar and the searchable list. */
export function ReviewsViewSkeleton() {
  return (
    <ViewSkeleton.Root asidePreferenceKey="reviews">
      <ViewSkeleton.Sidebar
        title={t('reviews.title')}
        createLabel={t('create.new')}
      />
      <ViewSkeleton.Main
        title={t('reviews.scopeInvolving')}
        tabs={[
          `• ${t('reviews.statusOpen')}`,
          `• ${t('reviews.statusClosed')}`,
          `• ${t('reviews.statusAll')}`,
        ]}
        controls={[1, 2, 1, `+ ${t('create.new')} ⌄`, 1]}
        searchPlaceholder={t('reviews.searchReviews')}
      />
    </ViewSkeleton.Root>
  );
}
