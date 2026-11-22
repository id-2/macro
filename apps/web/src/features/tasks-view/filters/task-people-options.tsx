import type { SearchableOptionSourceFactory } from '@app/features/next-soup/soup-view/filters-bar/option-source';
import { UserIcon } from '@core/component/UserIcon';
import { useUserId } from '@core/context/user';
import { useContactFilterOptions } from '@core/user/use-contact-filter-options';
import { Tooltip } from '@ui';
import { createMemo } from 'solid-js';
import { TASK_VIEWER } from './task-facets';

export function taskViewerOption(viewer: string | undefined) {
  return {
    id: TASK_VIEWER,
    label: 'Я',
    content: () => (
      <Tooltip label="Совпадает с тем, кто открывает этот сохранённый вид." as="span">
        Я
      </Tooltip>
    ),
    icon: () => (
      <UserIcon
        id={viewer ?? ''}
        name="Я"
        size="sm"
        class="size-3.5"
        suppressClick
        showTooltip={false}
      />
    ),
  };
}

/** The semantic viewer is not a directory identity; fixed self remains distinct. */
export function taskPeopleSource(
  allowViewer: boolean
): SearchableOptionSourceFactory {
  return (selected, enabled) => {
    const viewer = useUserId();
    const ids = createMemo(() => selected().filter((id) => id !== TASK_VIEWER));
    const source = useContactFilterOptions(ids, enabled);
    const includeViewer = () => allowViewer || selected().includes(TASK_VIEWER);
    return {
      ...source,
      options: () => [
        ...(includeViewer() ? [taskViewerOption(viewer())] : []),
        ...source.options(),
      ],
      visibleIds: () => [
        ...(includeViewer() &&
        'me'.includes(source.search().trim().toLowerCase())
          ? [TASK_VIEWER]
          : []),
        ...source.visibleIds(),
      ],
    };
  };
}
