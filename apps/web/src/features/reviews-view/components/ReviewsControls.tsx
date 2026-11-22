import {
  type ListControlOption,
  ListFilterDropdown,
  type ListFilterGroup,
  ListSortDropdown,
  MobileFilterDrawer,
  useViewControlHotkeys,
} from '@app/components/view-shell';
import { type TranslationKey, t } from '@app/lib/i18n';
import { PrOriginIcon, PrPriorityIcon } from '@block-pr/component/PrLinks';
import { PR_PRIORITY_IDS, type PrLinkKind } from '@block-pr/data/pr-links';
import { PR_ORIGIN_LABELS, PR_ORIGIN_TOOLS } from '@block-pr/data/pr-origin';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import BoardIcon from '@icon/system/regular/kanban.svg';
import ListIcon from '@icon/system/regular/list-bullets.svg';
import { Accordion } from '@kobalte/core/accordion';
import { ButtonGroup } from '@ui';
import { createSignal, For } from 'solid-js';
import { UNKNOWN_ORIGIN } from '../reviews-filter';
import type {
  ReviewsFilterId,
  ReviewsFilterSelection,
  ReviewsLayout,
  ReviewsReviewFilterId,
  ReviewsSortId,
  ReviewsStatusFilterId,
} from '../reviews-types';

export type ReviewsControlProps = {
  sort: ReviewsSortId;
  onSortChange: (sort: ReviewsSortId) => void;
  repositories: ListControlOption<string>[];
  authors: ListControlOption<string>[];
  assignees: ListControlOption<string>[];
  labels: ListControlOption<string>[];
  /** Offers the review filters that match the viewer's GitHub user id. */
  hasGithubIdentity: boolean;
  /** Leaves out Status, for layouts that lay pull requests out by status. */
  hideStatus?: boolean;
  selected: ReviewsFilterSelection;
  onFilterChange: (
    group: ReviewsFilterId,
    id: string,
    selected: boolean
  ) => void;
  onClearFilters: () => void;
};

const SORT_OPTIONS: ListControlOption<ReviewsSortId>[] = [
  { id: 'priority', get label() { return t('reviews.sortPriority'); } },
  {
    id: 'recently_updated',
    get label() { return t('reviews.sortRecentlyUpdated'); },
  },
  {
    id: 'least_recently_updated',
    get label() { return t('reviews.sortLeastRecentlyUpdated'); },
  },
  { id: 'newest', get label() { return t('reviews.sortNewest'); } },
  { id: 'oldest', get label() { return t('reviews.sortOldest'); } },
];

const STATUS_OPTIONS: ListControlOption<ReviewsStatusFilterId>[] = [
  { id: 'open', get label() { return t('reviews.statusOpen'); } },
  { id: 'closed', get label() { return t('reviews.statusClosed'); } },
  { id: 'merged', get label() { return t('reviews.statusMerged'); } },
];

const REVIEW_OPTIONS: ListControlOption<ReviewsReviewFilterId>[] = [
  { id: 'reviewed_by_me', get label() { return t('reviews.reviewedByMe'); } },
  {
    id: 'not_reviewed_by_me',
    get label() { return t('reviews.notReviewedByMe'); },
  },
  {
    id: 'awaiting_my_review',
    get label() { return t('reviews.awaitingMyReview'); },
  },
];

const PRIORITY_LABELS: Record<string, TranslationKey> = {
  urgent: 'reviews.priorityUrgent',
  high: 'reviews.priorityHigh',
  medium: 'reviews.priorityMedium',
  low: 'reviews.priorityLow',
  none: 'reviews.priorityNone',
};

const PRIORITY_OPTIONS: ListControlOption<string>[] = PR_PRIORITY_IDS.map(
  (id) => ({
    id,
    get label() {
      return t(PRIORITY_LABELS[id]);
    },
    icon: () => <PrPriorityIcon priority={id} />,
  })
);

const ORIGIN_OPTIONS: ListControlOption<string>[] = [
  ...PR_ORIGIN_TOOLS.map((tool) => ({
    id: tool,
    get label() {
      return PR_ORIGIN_LABELS[tool];
    },
    icon: () => <PrOriginIcon tool={tool} class="size-4" />,
  })),
  { id: UNKNOWN_ORIGIN, get label() { return t('reviews.unknownOrigin'); } },
];

const LINKED_OPTIONS: ListControlOption<string>[] = [
  { id: 'agent', get label() { return t('reviews.linkAgentSession'); } },
  { id: 'ticket', get label() { return t('reviews.linkTicket'); } },
  { id: 'customer', get label() { return t('reviews.linkCustomer'); } },
  { id: 'channel', get label() { return t('reviews.linkChannel'); } },
] satisfies ListControlOption<PrLinkKind>[];

function filterGroups(
  props: ReviewsControlProps
): ListFilterGroup<ReviewsFilterId, string>[] {
  return [
    ...(props.hideStatus
      ? []
      : [
          {
            id: 'status' as const,
            get label() {
              return t('reviews.filterStatus');
            },
            options: STATUS_OPTIONS,
          },
        ]),
    {
      id: 'priority',
      get label() {
        return t('reviews.filterPriority');
      },
      options: PRIORITY_OPTIONS,
    },
    {
      id: 'linked',
      get label() {
        return t('reviews.filterLinked');
      },
      options: LINKED_OPTIONS,
    },
    {
      id: 'origin',
      get label() {
        return t('reviews.filterStartedFrom');
      },
      options: ORIGIN_OPTIONS,
    },
    {
      id: 'repository',
      get label() {
        return t('reviews.filterRepository');
      },
      options: props.repositories,
      searchPlaceholder: t('reviews.searchRepositories'),
    },
    {
      id: 'author',
      get label() {
        return t('reviews.filterAuthor');
      },
      options: props.authors,
      searchPlaceholder: t('reviews.searchAuthors'),
    },
    {
      id: 'assignee',
      get label() {
        return t('reviews.filterAssignee');
      },
      options: props.assignees,
      searchPlaceholder: t('reviews.searchAssignees'),
    },
    {
      id: 'label',
      get label() {
        return t('reviews.filterLabel');
      },
      options: props.labels,
      searchPlaceholder: t('reviews.searchLabels'),
    },
    ...(props.hasGithubIdentity
      ? [
          {
            id: 'review' as const,
            get label() {
              return t('reviews.filterReviews');
            },
            options: REVIEW_OPTIONS,
          },
        ]
      : []),
  ];
}

function isSelected(
  props: ReviewsControlProps,
  group: ReviewsFilterId,
  id: string
) {
  return props.selected[group].includes(id);
}

export const activeReviewsFilterCount = (selected: ReviewsFilterSelection) =>
  Object.values(selected).reduce((count, ids) => count + ids.length, 0);

export function ReviewsControls(
  props: ReviewsControlProps & {
    layout: ReviewsLayout;
    onLayoutChange: (layout: ReviewsLayout) => void;
  }
) {
  const panel = useSplitPanelOrThrow();
  const [openMenu, setOpenMenu] = createSignal<'filters' | 'sort'>();
  let filterTrigger: HTMLButtonElement | undefined;
  let sortTrigger: HTMLButtonElement | undefined;

  const handleMenuOpenChange =
    (menu: 'filters' | 'sort') => (open: boolean) => {
      setOpenMenu((current) =>
        open ? menu : current === menu ? undefined : current
      );
    };

  useViewControlHotkeys({
    scopeId: panel.splitHotkeyScope,
    enabled: panel.isPanelActive,
    filter: {
      description: t('reviews.filterPullRequests'),
      run: () => {
        if (!filterTrigger) return false;
        setOpenMenu('filters');
        return true;
      },
    },
    sort: {
      description: t('reviews.sortPullRequests'),
      run: () => {
        if (!sortTrigger) return false;
        setOpenMenu('sort');
        return true;
      },
    },
  });

  const activeCount = () => activeReviewsFilterCount(props.selected);

  return (
    <>
      <HeaderActionGroup label={t('reviews.reviewFilters')} size="md">
        <ListFilterDropdown
          grouped
          size={activeCount() ? 'md' : 'icon-md'}
          label={t('reviews.filterPullRequests')}
          activeCount={activeCount()}
          groups={filterGroups(props)}
          open={openMenu() === 'filters'}
          onOpenChange={handleMenuOpenChange('filters')}
          triggerRef={(element) => (filterTrigger = element)}
          isSelected={(group, id) => isSelected(props, group, id)}
          selectedIds={(group) => props.selected[group]}
          onSelectionChange={props.onFilterChange}
          onClear={props.onClearFilters}
        />
      </HeaderActionGroup>
      <HeaderActionGroup label={t('reviews.reviewLayout')} size="md">
        <ButtonGroup.Button
          aria-label={t('reviews.layoutList')}
          tooltip={t('reviews.layoutList')}
          variant="ghost"
          size="icon-md"
          aria-pressed={props.layout === 'list'}
          onClick={() => props.onLayoutChange('list')}
        >
          <ListIcon class="size-4" />
        </ButtonGroup.Button>
        <ButtonGroup.Button
          aria-label={t('reviews.layoutBoard')}
          tooltip={t('reviews.layoutBoard')}
          variant="ghost"
          size="icon-md"
          aria-pressed={props.layout === 'board'}
          onClick={() => props.onLayoutChange('board')}
        >
          <BoardIcon class="size-4" />
        </ButtonGroup.Button>
      </HeaderActionGroup>
      <HeaderActionGroup label={t('reviews.reviewViewOptions')} size="md">
        <ListSortDropdown
          grouped
          size="icon-md"
          label={t('reviews.sortPullRequests')}
          value={props.sort}
          options={SORT_OPTIONS}
          open={openMenu() === 'sort'}
          onChange={props.onSortChange}
          onOpenChange={handleMenuOpenChange('sort')}
          triggerRef={(element) => (sortTrigger = element)}
        />
      </HeaderActionGroup>
    </>
  );
}

export function ReviewsFilterDrawer(props: ReviewsControlProps) {
  const groups = () => filterGroups(props);
  const activeCount = () => activeReviewsFilterCount(props.selected);

  return (
    <MobileFilterDrawer
      triggerLabel={t('reviews.openPullRequestFilters')}
      label={t('reviews.pullRequestListControls')}
      activeCount={activeCount()}
      onClear={props.onClearFilters}
    >
      <MobileDrawer.Label id="reviews-sort-label" class="pt-4">
        {t('viewMenus.sort')}
      </MobileDrawer.Label>
      <MobileDrawer.Section
        role="radiogroup"
        aria-labelledby="reviews-sort-label"
      >
        <For each={SORT_OPTIONS}>
          {(option) => (
            <MobileFilterDrawer.Option
              selectionMode="single"
              checked={props.sort === option.id}
              onChange={() => props.onSortChange(option.id)}
            >
              {option.label}
            </MobileFilterDrawer.Option>
          )}
        </For>
      </MobileDrawer.Section>
      <MobileDrawer.Label class="pt-4">{t('viewMenus.filters')}</MobileDrawer.Label>
      <Accordion multiple collapsible defaultValue={['priority']}>
        <div class="flex flex-col gap-3">
          <For each={groups()}>
            {(group) => (
              <MobileFilterDrawer.Section
                value={group.id}
                label={group.label}
                activeCount={
                  group.options.filter((option) =>
                    isSelected(props, group.id, option.id)
                  ).length
                }
              >
                <For each={group.options}>
                  {(option) => (
                    <MobileFilterDrawer.Option
                      checked={isSelected(props, group.id, option.id)}
                      onChange={(selected) =>
                        props.onFilterChange(group.id, option.id, selected)
                      }
                    >
                      {option.content?.() ?? option.label}
                    </MobileFilterDrawer.Option>
                  )}
                </For>
              </MobileFilterDrawer.Section>
            )}
          </For>
        </div>
      </Accordion>
    </MobileFilterDrawer>
  );
}
