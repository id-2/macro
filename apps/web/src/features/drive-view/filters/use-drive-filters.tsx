import type { ListFilterGroup } from '@app/components/view-shell';
import { t } from '@app/lib/i18n';
import { EntityIcon } from '@core/component/EntityIcon';
import { useContactFilterOptions } from '@core/user/use-contact-filter-options';
import { useTagFilterGroup } from '@property/tags/use-tag-filter-group';
import { createMemo } from 'solid-js';
import { useDriveView } from '../context/drive-context';

export type DriveFilterGroupId = 'type' | 'created-by' | 'tags' | 'scope';

const typeOptions = [
  { id: 'database', get label() { return t('drive.filterDatabase'); }, type: 'database' },
  { id: 'form', get label() { return t('drive.filterForm'); }, type: 'form' },
  { id: 'doc-markdown', get label() { return t('drive.filterMarkdown'); }, type: 'md' },
  { id: 'doc-canvas', get label() { return t('viewMenus.canvas'); }, type: 'canvas' },
  {
    id: 'doc-spreadsheet',
    get label() { return t('viewMenus.spreadsheet'); },
    type: 'spreadsheet',
  },
  { id: 'file-code', get label() { return t('viewMenus.code'); }, type: 'code' },
  { id: 'file-image', get label() { return t('viewMenus.images'); }, type: 'image' },
  { id: 'file-pdf', get label() { return t('viewMenus.pdfs'); }, type: 'pdf' },
  { id: 'file-docx', get label() { return t('drive.filterDocx'); }, type: 'write' },
  { id: 'file-video', get label() { return t('viewMenus.videos'); }, type: 'video' },
  { id: 'doc-snippet', get label() { return t('viewMenus.snippets'); }, type: 'snippet' },
  { id: 'doc-skill', get label() { return t('viewMenus.skills'); }, type: 'skill' },
  { id: 'file-other', get label() { return t('viewMenus.other'); }, type: 'files' },
] as const;

/** Filter model shared by the desktop filter dropdown and the mobile drawer. */
export function useDriveFilters() {
  const { state } = useDriveView();

  const tagGroup = useTagFilterGroup();

  // Menu structure only depends on location/scope, not the selected facets.
  // Reading the whole state in `groups` remounts its submenus on each selection.
  const showCreators = createMemo(() => {
    const { location, scope } = state.value();

    if (location.kind === 'folder') return true;

    return location.tab !== 'owned' || scope !== 'default';
  });
  const isRecent = createMemo(() => {
    const location = state.value().location;
    return location.kind === 'tab' && location.tab === 'recent';
  });

  const groups = createMemo(() => {
    const groups: ListFilterGroup<DriveFilterGroupId, string>[] = [];

    if (!isRecent()) {
      const tags = tagGroup();

      if (tags.options.length > 0) groups.push(tags);

      groups.push({
        id: 'type',
        get label() {
          return t('viewMenus.type');
        },
        options: typeOptions.map((option) => ({
          id: option.id,
          label: option.label,

          icon: () => <EntityIcon targetType={option.type} size="xs" />,
        })),
      });

      if (showCreators()) {
        groups.push({
          id: 'created-by',
          get label() {
            return t('viewMenus.createdBy');
          },
          searchPlaceholder: t('viewMenus.searchCreators'),
          options: [],
          createSource: useContactFilterOptions,
        });
      }
    }

    groups.push({
      id: 'scope',
      get label() {
        return t('drive.filterFilesGroup');
      },
      selectionMode: 'single',
      defaultOptionId: 'default',
      options: [
        { id: 'default', get label() { return t('drive.scopeDefault'); } },
        { id: 'all', get label() { return t('drive.scopeAllFiles'); } },
        {
          id: 'attachments',
          get label() { return t('drive.scopeAttachments'); },
        },
      ],
    });

    return groups;
  });

  const setTagSelected = (id: string, selected: boolean) => {
    const ids = (state.value().facets.tags ?? []).filter(
      (value) => value !== id
    );

    if (selected) ids.push(id);

    state.setTags(ids);
  };

  const isSelected = (group: DriveFilterGroupId, id: string) => {
    if (group === 'scope') return state.value().scope === id;

    return state.value().facets[group]?.includes(id) ?? false;
  };

  const setSelected = (
    group: DriveFilterGroupId,
    id: string,
    selected: boolean
  ) => {
    if (group === 'scope') {
      if (id === 'default' || id === 'all' || id === 'attachments')
        state.setScope(id);

      return;
    }

    if (group === 'tags') {
      setTagSelected(id, selected);

      return;
    }

    state.setFacetSelected(group, id, selected);
  };

  const activeCount = () => {
    const { facets, scope } = state.value();

    const facetCount = Object.values(facets).reduce(
      (count, ids) => count + ids.length,
      0
    );

    return facetCount + (scope === 'default' ? 0 : 1);
  };

  return {
    groups,
    isSelected,
    selectedIds: (group: DriveFilterGroupId) =>
      group === 'scope'
        ? [state.value().scope]
        : (state.value().facets[group] ?? []),
    setSelected,
    activeCount,
    clear: state.clearFilters,
  };
}
