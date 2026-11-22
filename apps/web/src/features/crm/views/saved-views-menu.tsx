import { toast } from '@core/component/Toast/Toast';
import FloppyDiskIcon from '@icon/system/regular/floppy-disk.svg';
import LinkIcon from '@icon/system/regular/link.svg';
import PushPinIcon from '@icon/system/regular/push-pin.svg';
import SlidersIcon from '@icon/system/regular/sliders-horizontal.svg';
import StackIcon from '@icon/system/regular/stack.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import { Button, ButtonGroup, cn, Dropdown, Tabs, Tooltip } from '@ui';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { t } from '@app/lib/i18n';
import { useCrmContext } from '../context/crm-context';
import { useCrmWorkspace } from '../context/workspace-context';
import {
  crmListColumnLabel,
  type CrmListColumnId,
} from '../core/display-options';
import type { CrmViewConfig } from '../core/saved-view';
import { useApplyCrmView } from './apply-view';
import {
  useCrmDisplayOptions,
  useCrmPermissions,
  usePersonalCrmViews,
  useTeamCrmViews,
  useCrmUserId as useUserId,
} from './use-crm';

/**
 * Saved-view row: the name applies the view; trailing hover actions pin it
 * as the default, copy its share link, or delete it. The pin stays visible
 * on the current default.
 */
const SavedViewRow = (props: {
  name: string;
  isDefault?: boolean;
  onApply: () => void;
  onCopyLink: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
}) => (
  <div class="group rounded-lg w-full flex items-center gap-0.5 pl-2 pr-1 hover:bg-ink/5">
    <button
      type="button"
      class="flex-1 min-w-0 truncate py-1.5 text-left text-sm"
      onClick={props.onApply}
    >
      {props.name}
    </button>
    <Show when={props.isDefault && !props.onSetDefault}>
      <PushPinIcon class="size-3.5 shrink-0 text-ink-muted" />
    </Show>
    <Show when={props.onSetDefault}>
      {(onSetDefault) => (
        <Tooltip
          label={
            props.isDefault ? t('crm.removeDefault') : t('crm.setAsDefault')
          }
        >
          <Button
            aria-label={
              props.isDefault ? t('crm.removeDefault') : t('crm.setAsDefault')
            }
            tooltip={
              props.isDefault ? t('crm.removeDefault') : t('crm.setAsDefault')
            }
            variant="ghost"
            size="icon-sm"
            class={cn(
              'size-6 shrink-0 p-1 text-ink-muted',
              !props.isDefault &&
                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            )}
            onClick={() => onSetDefault()()}
          >
            <PushPinIcon class="size-3.5" />
          </Button>
        </Tooltip>
      )}
    </Show>
    <Tooltip label={t('crm.copyLink')}>
      <Button
        aria-label={t('crm.copyLink')}
        tooltip={t('crm.copyLink')}
        variant="ghost"
        size="icon-sm"
        class="size-6 shrink-0 p-1 text-ink-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={props.onCopyLink}
      >
        <LinkIcon class="size-3.5" />
      </Button>
    </Tooltip>
    <Show when={props.onDelete}>
      {(onDelete) => (
        <Tooltip label={t('crm.deleteView')}>
          <Button
            aria-label={t('crm.deleteView')}
            tooltip={t('crm.deleteView')}
            variant="ghost"
            size="icon-sm"
            class="size-6 shrink-0 p-1 text-ink-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onDelete()()}
          >
            <TrashIcon class="size-3.5" />
          </Button>
        </Tooltip>
      )}
    </Show>
  </div>
);

const EmptyViewsHint = (props: { children: JSX.Element }) => (
  <div class="px-2 py-1.5 text-xs text-ink-extra-muted">{props.children}</div>
);

/**
 * Saved-views dropdown for the Customers view: personal and team-shared
 * snapshots of the full view state (filters, search, grouping, sort,
 * list/board mode, stage/owner sub-filters, tab), plus share links that
 * encode the same state into the URL (see `queries/saved-view-codec.ts`).
 */
export function CompanyViewsMenu(
  props: { hideLabel?: boolean; grouped?: boolean } = {}
) {
  const copyShareLink = useCrmContext().copyViewLink;
  const {
    soup,
    queryFilters,
    searchText,
    stageFilter,
    ownerFilter,
    activeTab,
  } = useCrmWorkspace();
  const personal = usePersonalCrmViews();
  const team = useTeamCrmViews();
  const { canEditCrm } = useCrmPermissions();
  const userId = useUserId();

  const [open, setOpen] = createSignal(false);
  const [saveFormOpen, setSaveFormOpen] = createSignal(false);
  const [saveName, setSaveName] = createSignal('');
  const [saveScope, setSaveScope] = createSignal<'personal' | 'team'>(
    'personal'
  );

  const captureCurrentView = (): CrmViewConfig => ({
    kind: 'crm',
    // JSON-safe snapshot — the store's state must not leak by reference.
    filters: structuredClone(unwrap(queryFilters.state)),
    clientFilters: {
      and: [...soup.predicates.andIds()],
      or: [...soup.predicates.orIds()],
    },
    searchText: searchText(),
    groupBy: soup.grouping.activeGroupId() ?? null,
    sort: soup.sort.active().map((s) => s.id),
    stageFilter: [...stageFilter()],
    ownerFilter: [...ownerFilter()],
    activeTab: activeTab(),
  });

  const applyCrmView = useApplyCrmView();

  const applyView = (config: CrmViewConfig) => {
    applyCrmView(config);
    setOpen(false);
  };

  const saveCurrentView = () => {
    const name = saveName().trim();
    if (!name) return;
    const config = captureCurrentView();
    if (saveScope() === 'team') {
      team.add(name, config);
    } else {
      personal.create.mutate({ name, config });
    }
    setSaveFormOpen(false);
    setSaveName('');
    setOpen(false);
    toast.success(t('crm.viewSaved'));
  };

  const canDeleteTeamView = (createdBy: string | undefined) =>
    canEditCrm() || (createdBy !== undefined && createdBy === userId());

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSaveFormOpen(false);
      setSaveName('');
    }
  };

  const triggerSize = () => {
    if (!props.hideLabel) return 'sm';
    return 'icon-md';
  };

  return (
    <Dropdown open={open()} onOpenChange={handleOpenChange}>
      <Dropdown.Trigger
        tooltip={props.hideLabel ? t('crm.views') : undefined}
        as={props.grouped ? ButtonGroup.Button : Button}
        variant="ghost"
        size={triggerSize()}
        aria-label={props.hideLabel ? t('crm.views') : undefined}
      >
        <StackIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
        <Show when={!props.hideLabel}>
          <span>{t('crm.views')}</span>
        </Show>
      </Dropdown.Trigger>

      <Dropdown.Content class="w-64">
        <Dropdown.Group>
          <Dropdown.GroupLabel>{t('crm.myViews')}</Dropdown.GroupLabel>
          <For
            each={personal.views()}
            fallback={<EmptyViewsHint>{t('crm.noSavedViews')}</EmptyViewsHint>}
          >
            {(view) => (
              <SavedViewRow
                name={view.name}
                isDefault={view.config.isDefault === true}
                onApply={() => applyView(view.config)}
                onCopyLink={() => copyShareLink(view.config)}
                onSetDefault={() =>
                  personal.setDefault.mutate({
                    id: view.config.isDefault ? undefined : view.id,
                  })
                }
                onDelete={() => personal.remove.mutate({ id: view.id })}
              />
            )}
          </For>
        </Dropdown.Group>

        <Dropdown.Group>
          <Dropdown.GroupLabel>{t('crm.teamViews')}</Dropdown.GroupLabel>
          <For
            each={team.views()}
            fallback={<EmptyViewsHint>{t('crm.noTeamViews')}</EmptyViewsHint>}
          >
            {(view) => (
              <SavedViewRow
                name={view.name}
                isDefault={view.id === team.defaultViewId()}
                onApply={() => applyView(view.config as CrmViewConfig)}
                onCopyLink={() => copyShareLink(view.config as CrmViewConfig)}
                onSetDefault={
                  canEditCrm()
                    ? () =>
                        team.setDefault(
                          view.id === team.defaultViewId() ? undefined : view.id
                        )
                    : undefined
                }
                onDelete={
                  canDeleteTeamView(view.createdBy)
                    ? () => team.remove(view.id)
                    : undefined
                }
              />
            )}
          </For>
        </Dropdown.Group>

        <Dropdown.Group>
          <Show
            when={saveFormOpen()}
            fallback={
              <Dropdown.Item
                closeOnSelect={false}
                onSelect={() => setSaveFormOpen(true)}
              >
                <FloppyDiskIcon class="size-3.5 shrink-0 text-ink-muted" />
                <span class="flex-1 truncate">{t('crm.saveCurrentView')}</span>
              </Dropdown.Item>
            }
          >
            <div class="flex flex-col gap-1.5 p-1.5">
              <input
                ref={(el) => requestAnimationFrame(() => el.focus())}
                value={saveName()}
                onInput={(e) => setSaveName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  // Keep character keys / Enter away from the menu's
                  // typeahead and item selection; Escape still closes.
                  if (e.key === 'Escape') return;
                  e.stopPropagation();
                  if (e.key === 'Enter') saveCurrentView();
                }}
                placeholder={t('crm.viewName')}
                class={cn(
                  'w-full rounded-md border border-edge-muted bg-transparent px-2 py-1 text-sm',
                  'outline-none focus:border-accent placeholder:text-ink-placeholder'
                )}
              />
              <div class="flex items-center justify-between gap-1.5">
                <Tabs
                  touch="segmented"
                  size="sm"
                  aria-label={t('crm.viewVisibility')}
                  value={saveScope()}
                  onChange={(value) => setSaveScope(value)}
                  options={[
                    { value: 'personal', label: t('crm.personal') },
                    { value: 'team', label: t('crm.team') },
                  ]}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!saveName().trim()}
                  onClick={saveCurrentView}
                >
                  {t('crm.save')}
                </Button>
              </div>
            </div>
          </Show>
          <Dropdown.CopyItem
            icon={<LinkIcon class="size-4" />}
            onCopy={() => copyShareLink(captureCurrentView(), { silent: true })}
          >
            <span class="flex-1 truncate">{t('crm.copyLinkCurrentView')}</span>
          </Dropdown.CopyItem>
        </Dropdown.Group>
      </Dropdown.Content>
    </Dropdown>
  );
}

/**
 * Personal display options for the Customers view: which property columns
 * show in the list. Device-level (preference-backed) — deliberately not
 * captured by saved views. Archive visibility is a separate scoped filter.
 */
export function CompanyDisplayMenu(props: { grouped?: boolean } = {}) {
  const { options, toggleListColumn } = useCrmDisplayOptions();

  return (
    <Dropdown>
      <Tooltip label={t('crm.displayOptions')}>
        <Dropdown.Trigger
          aria-label={t('crm.displayOptions')}
          tooltip={t('crm.displayOptions')}
          as={props.grouped ? ButtonGroup.Button : Button}
          variant="ghost"
          size="icon-md"
        >
          <SlidersIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
        </Dropdown.Trigger>
      </Tooltip>

      <Dropdown.Content class="w-56">
        <Dropdown.Group>
          <Dropdown.GroupLabel>{t('crm.listColumns')}</Dropdown.GroupLabel>
          <For
            each={
              ['stage', 'owner', 'revenue'] as CrmListColumnId[]
            }
          >
            {(column) => (
              <Dropdown.CheckboxItem
                checked={options().listColumns[column]}
                onChange={() => toggleListColumn(column)}
                closeOnSelect={false}
              >
                <span class="flex-1 truncate">
                  {crmListColumnLabel(column)}
                </span>
              </Dropdown.CheckboxItem>
            )}
          </For>
        </Dropdown.Group>
      </Dropdown.Content>
    </Dropdown>
  );
}
