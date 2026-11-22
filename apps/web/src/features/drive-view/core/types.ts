import type { FacetSelection } from '@app/features/soup/filters/facets/types';
import { t } from '@app/lib/i18n';

export type DriveTab = 'owned' | 'recent' | 'shared';
export type DriveScope = 'default' | 'all' | 'attachments';
export type DriveSort = 'updated_at' | 'created_at' | 'viewed_at' | 'name';

export type DriveLocation =
  | { kind: 'tab'; tab: DriveTab }
  | { kind: 'folder'; id: string | null };

export type DriveFolder = {
  id: string;
  name: string;
  parentId?: string | null;
};

export type DriveFolderNode = DriveFolder & { children: DriveFolderNode[] };

export type DriveState = {
  location: DriveLocation;
  scope: DriveScope;
  sort: DriveSort;
  search: string;
  facets: FacetSelection;
  expandedFolderIds: string[];
  favoritesOpen: boolean;
  databasesOpen: boolean;
  rootOpen: boolean;
};

export const DRIVE_TABS = [
  {
    id: 'owned',
    get label() {
      return t('drive.tabOwned');
    },
  },
  {
    id: 'recent',
    get label() {
      return t('drive.tabRecent');
    },
  },
  {
    id: 'shared',
    get label() {
      return t('drive.tabShared');
    },
  },
] satisfies { id: DriveTab; label: string }[];

export const DRIVE_SORT_OPTIONS = [
  {
    id: 'updated_at',
    get label() {
      return t('drive.sortUpdated');
    },
  },
  {
    id: 'created_at',
    get label() {
      return t('drive.sortCreated');
    },
  },
  {
    id: 'viewed_at',
    get label() {
      return t('drive.sortViewed');
    },
  },
  {
    id: 'name',
    get label() {
      return t('viewMenus.sortName');
    },
  },
] satisfies { id: DriveSort; label: string }[];
