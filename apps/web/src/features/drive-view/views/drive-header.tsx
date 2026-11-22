import {
  ListSortDropdown,
  useViewControlHotkeys,
} from '@app/components/view-shell';
import { t } from '@app/lib/i18n';
import {
  ListHeader,
  ListHeaderSearch,
} from '@app/components/view-shell/ListHeader';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Show, Suspense } from 'solid-js';
import { DriveBreadcrumbsOutlet } from '../components/DriveBreadcrumbs';
import { useDriveView } from '../context/drive-context';
import { DRIVE_SORT_OPTIONS } from '../core/types';
import { DriveCreateMenu } from '../drive-create-menu';
import { DriveFilterMenu } from './drive-filter-menu';

export function DriveHeader() {
  const { state } = useDriveView();

  const isRecent = () => {
    const location = state.value().location;

    return location.kind === 'tab' && location.tab === 'recent';
  };

  const panel = useSplitPanelOrThrow();

  let focusSearch: (() => void) | undefined;

  useViewControlHotkeys({
    scopeId: panel.splitHotkeyScope,
    enabled: () => panel.isPanelActive() && !isTouchDevice(),
    search: {
      description: t('drive.searchDrive'),

      condition: () => !state.projectId(),

      run: () => {
        focusSearch?.();

        return true;
      },
    },
  });

  return (
    <Show when={!isTouchDevice()}>
      <ListHeader
        title={<DriveBreadcrumbsOutlet aria-label={t('drive.driveLocation')} />}
      >
        <Show when={state.value().location.kind === 'tab'}>
          <HeaderActionGroup label={t('drive.fileFilters')} size="md">
            <Suspense>
              <DriveFilterMenu grouped size="icon-md" />
            </Suspense>
          </HeaderActionGroup>
        </Show>
        <Show when={!isRecent()}>
          <HeaderActionGroup label={t('drive.fileViewOptions')} size="md">
            <ListSortDropdown
              grouped
              size="icon-md"
              label={t('drive.sortFiles')}
              value={state.value().sort}
              onChange={state.setSort}
              options={DRIVE_SORT_OPTIONS}
            />
          </HeaderActionGroup>
        </Show>
        <DriveCreateMenu presentation="toolbar" />
        <Show when={!state.projectId()}>
          <ListHeaderSearch
            label={t('drive.searchDrive')}
            placeholder={t('drive.searchFiles')}
            value={state.value().search}
            focusResults={() => panel.panelRef()?.focus()}
            onValueChange={state.setSearch}
            registerFocus={(focus) => {
              focusSearch = focus;
            }}
          />
        </Show>
      </ListHeader>
    </Show>
  );
}
