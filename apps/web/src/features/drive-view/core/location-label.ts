import { t } from '@app/lib/i18n';
import { DRIVE_TABS, type DriveFolder, type DriveLocation } from './types';

export function driveLocationLabel(
  location: DriveLocation,
  folders: readonly DriveFolder[] = []
): string {
  if (location.kind === 'folder') {
    return (
      folders.find((folder) => folder.id === location.id)?.name ?? t('drive.title')
    );
  }
  return (
    DRIVE_TABS.find((tab) => tab.id === location.tab)?.label ??
    t('drive.tabOwned')
  );
}

/** Where Drive's New menu creates items: the open folder, else the root. */
export function driveCreateDestinationLabel(
  projectId: string | undefined,
  folders: readonly DriveFolder[] = []
): string {
  if (!projectId) return t('drive.title');
  return (
    folders.find((folder) => folder.id === projectId)?.name ??
    t('drive.folderWord')
  );
}
