import { ViewSkeleton } from '@app/components/view-shell/ViewSkeleton';
import { t } from '@app/lib/i18n';

/** Drive while its code loads: the folders sidebar and the searchable file list. */
export function DriveViewSkeleton() {
  return (
    <ViewSkeleton.Root asidePreferenceKey="documents">
      <ViewSkeleton.Sidebar
        title={t('drive.title')}
        createLabel={t('create.new')}
      />
      <ViewSkeleton.Main
        title={t('drive.tabOwned')}
        controls={[1, 1, `+ ${t('create.new')} ⌄`, 1]}
        searchPlaceholder={t('drive.searchFiles')}
      />
    </ViewSkeleton.Root>
  );
}
