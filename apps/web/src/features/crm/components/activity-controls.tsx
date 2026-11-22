import { t } from '@app/lib/i18n';
import {
  ListFilterDropdown,
  ListGroupDropdown,
  ListSortDropdown,
} from '@app/components/view-shell/ListDropdowns';
import { MobileFilterDrawer } from '@app/components/view-shell/MobileFilterDrawer';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Accordion } from '@kobalte/core/accordion';
import { createSignal, For, Show } from 'solid-js';
import type { ActivityFilters } from '../context/crm-context';
import type { CrmActivityViewState } from '../core/activity-view';

const sortOptions = () =>
  [
    { id: 'updated_at' as const, label: t('viewMenus.sortLastUpdated') },
    { id: 'created_at' as const, label: t('viewMenus.sortDateCreated') },
    { id: 'viewed_at' as const, label: t('viewMenus.sortLastViewed') },
  ] satisfies { id: CrmActivityViewState['sort']; label: string }[];
const groupOptions = () =>
  [
    { id: 'date' as const, label: t('viewMenus.date') },
    { id: 'none' as const, label: t('viewMenus.groupNone') },
  ] satisfies { id: CrmActivityViewState['groupBy']; label: string }[];
const directionOptions = () =>
  [
    { id: 'desc' as const, label: t('crm.sortNewestFirst') },
    { id: 'asc' as const, label: t('crm.sortOldestFirst') },
  ] satisfies { id: CrmActivityViewState['direction']; label: string }[];

export function ActivityControls(props: {
  label: string;
  state: CrmActivityViewState;
  filters: ActivityFilters;
  setSort(value: CrmActivityViewState['sort']): void;
  setDirection(value: CrmActivityViewState['direction']): void;
  setGroupBy(value: CrmActivityViewState['groupBy']): void;
}) {
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  return (
    <Show
      when={!isTouchDevice()}
      fallback={
        <MobileFilterDrawer
          open={drawerOpen()}
          onOpenChange={setDrawerOpen}
          triggerLabel={t('crm.openFiltersFor', { label: props.label })}
          label={t('crm.listControlsFor', { label: props.label })}
          activeCount={props.filters.activeCount()}
          onClear={props.filters.clear}
        >
          <MobileDrawer.Label class="pt-4">{t('crm.sort')}</MobileDrawer.Label>
          <MobileDrawer.Section role="radiogroup" aria-label={t('crm.sort')}>
            <For each={sortOptions()}>
              {(option) => (
                <MobileFilterDrawer.Option
                  selectionMode="single"
                  checked={props.state.sort === option.id}
                  onChange={() => props.setSort(option.id)}
                >
                  {option.label}
                </MobileFilterDrawer.Option>
              )}
            </For>
          </MobileDrawer.Section>
          <MobileDrawer.Section role="radiogroup" aria-label={t('crm.sortDirection')}>
            <For each={directionOptions()}>
              {(option) => (
                <MobileFilterDrawer.Option
                  selectionMode="single"
                  checked={props.state.direction === option.id}
                  onChange={() => props.setDirection(option.id)}
                >
                  {option.label}
                </MobileFilterDrawer.Option>
              )}
            </For>
          </MobileDrawer.Section>
          <MobileDrawer.Label class="pt-4">{t('crm.group')}</MobileDrawer.Label>
          <MobileDrawer.Section role="radiogroup" aria-label={t('crm.group')}>
            <For each={groupOptions()}>
              {(option) => (
                <MobileFilterDrawer.Option
                  selectionMode="single"
                  checked={props.state.groupBy === option.id}
                  onChange={() => props.setGroupBy(option.id)}
                >
                  {option.label}
                </MobileFilterDrawer.Option>
              )}
            </For>
          </MobileDrawer.Section>
          <MobileDrawer.Label class="pt-4">{t('crm.filters')}</MobileDrawer.Label>
          <Accordion
            multiple
            collapsible
            defaultValue={[props.filters.groups()[0]?.id ?? 'tags']}
          >
            <For each={props.filters.groups()}>
              {(group) => (
                <MobileFilterDrawer.Section
                  value={group.id}
                  label={group.label}
                  activeCount={props.filters.selectedIds(group.id).length}
                >
                  <div
                    role={
                      group.selectionMode === 'single' ? 'radiogroup' : 'group'
                    }
                    aria-label={group.label}
                  >
                    <Show
                      when={group.createSource}
                      fallback={
                        <For each={group.options}>
                          {(option) => (
                            <MobileFilterDrawer.Option
                              selectionMode={group.selectionMode}
                              checked={props.filters.isSelected(
                                group.id,
                                option.id
                              )}
                              onChange={(checked) =>
                                props.filters.setSelected(
                                  group.id,
                                  option.id,
                                  checked
                                )
                              }
                              icon={option.icon?.()}
                            >
                              {option.label}
                            </MobileFilterDrawer.Option>
                          )}
                        </For>
                      }
                    >
                      {(createSource) => (
                        <MobileFilterDrawer.SourceOptions
                          groupId={group.id}
                          createSource={createSource()}
                          enabled={drawerOpen}
                          activeIds={() => props.filters.selectedIds(group.id)}
                          placeholder={group.searchPlaceholder}
                          onChange={(id, checked) =>
                            props.filters.setSelected(group.id, id, checked)
                          }
                        />
                      )}
                    </Show>
                  </div>
                </MobileFilterDrawer.Section>
              )}
            </For>
          </Accordion>
        </MobileFilterDrawer>
      }
    >
      <HeaderActionGroup
        label={t('crm.filtersFor', { label: props.label })}
      >
        <ListFilterDropdown
          label={t('crm.filterFor', { label: props.label })}
          activeCount={props.filters.activeCount()}
          groups={props.filters.groups()}
          isSelected={props.filters.isSelected}
          selectedIds={props.filters.selectedIds}
          onSelectionChange={props.filters.setSelected}
          onClear={props.filters.clear}
        />
      </HeaderActionGroup>
      <HeaderActionGroup
        label={t('crm.viewOptionsFor', { label: props.label })}
      >
        <ListSortDropdown
          label={t('crm.sortFor', { label: props.label })}
          value={props.state.sort}
          options={sortOptions()}
          onChange={props.setSort}
        />
        <ListSortDropdown
          label={t('crm.sortDirection')}
          value={props.state.direction}
          options={directionOptions()}
          onChange={props.setDirection}
        />
        <ListGroupDropdown
          label={t('crm.groupBy')}
          value={props.state.groupBy}
          options={groupOptions()}
          onChange={props.setGroupBy}
        />
      </HeaderActionGroup>
    </Show>
  );
}
