import type { ItemDragOverlayData } from '@app/components/app/ItemDragAndDrop';
import { ListSkeleton } from '@app/components/view-shell/ListSkeleton';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import CaretDownIcon from '@icon/system/regular/caret-down.svg';
import CaretUpIcon from '@icon/system/regular/caret-up.svg';
import CheckIcon from '@icon/system/regular/check.svg';
import DotsSixVerticalIcon from '@icon/system/regular/dots-six-vertical.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import SpinnerIcon from '@icon/system/regular/spinner.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import XIcon from '@icon/system/regular/x.svg';
import {
  createSortable,
  maybeTransformStyle,
  SortableProvider,
  useDragDropContext,
  useSortableContext,
} from '@thisbeyond/solid-dnd';
import { Button, ConfirmDialog, cn, Tooltip } from '@ui';
import { For, type JSX, Match, Show, Suspense, Switch } from 'solid-js';
import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
} from '../../settings/primitives';
import { CrmStageIcon } from '../components/stage-icon';
import { useCrmContext } from '../context/crm-context';
import { createStageEditor } from '../primitives/stage-editor';
import { CrmEmailPrivacySettings } from './email-privacy';
import { EmailSyncSection } from './email-sync-settings';
import {
  useCrmPermissions,
  useCurrentTeamQuery,
  useDealStages,
  useReplaceCrmStagesMutation,
  useResetCrmStagesMutation,
  useTeamCrmConfig,
} from './use-crm';

/* ------------------------------------------------------------------ */
/* Deal stages                                                        */
/* ------------------------------------------------------------------ */

/**
 * Drag data carried by stage row sortables. Distinct from `EntityDragData`
 * so entity drop consumers ignore stage drags. Supplies its own overlay icon.
 */
type StageDragData = ItemDragOverlayData & {
  dragType: 'stage';
  name: string;
};

/**
 * Reordering follows the GOV.UK reorderable list: a drag handle with pointer
 * drag and arrow-key moves on desktop, plain up/down buttons on touch. The
 * pointer sensor in solid-dnd listens to mouse events only, so touch gets the
 * buttons rather than a handle that would fight the page scroll.
 */
function useStageReorderMode(): 'drag' | 'buttons' {
  const canDrag =
    useDragDropContext() !== null && useSortableContext() !== null;
  return canDrag && !isTouchDevice() ? 'drag' : 'buttons';
}

/** Wraps the rows in a sortable context when the app-wide drag provider is present. */
function StageList(props: { ids: string[]; children: JSX.Element }) {
  const dnd = useDragDropContext();
  return (
    <Show when={dnd !== null} fallback={props.children}>
      <SortableProvider ids={props.ids}>{props.children}</SortableProvider>
    </Show>
  );
}

/** Same colored icon the CRM list groups and filters show for a stage. */
function StageIcon(props: { id: string; index: number }) {
  return (
    <CrmStageIcon optionId={props.id} index={props.index} class="size-3.5" />
  );
}

function StageRow(props: { id: string; label: string; index: number }) {
  return (
    <div class="flex min-h-12 items-center gap-3 px-4 py-3">
      <StageIcon id={props.id} index={props.index} />
      <span class="min-w-0 truncate text-sm text-ink">{props.label}</span>
    </div>
  );
}

/** Reads as plain text until hovered or focused, so the list stays a list. */
function InlineStageInput(props: {
  value: string;
  placeholder: string;
  label: string;
  onInput: (value: string) => void;
  onKeyDown: (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
}) {
  return (
    <input
      type="text"
      value={props.value}
      aria-label={props.label}
      placeholder={props.placeholder}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      onKeyDown={(e) => props.onKeyDown(e)}
      class="-mx-2 h-8 min-w-0 flex-1 truncate rounded-md bg-transparent px-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-placeholder not-touch:hover:bg-hover focus:bg-control focus-visible:ring-2 focus-visible:ring-edge-muted"
    />
  );
}

function StageEditorRow(props: {
  id: string;
  label: string;
  draft: string | undefined;
  index: number;
  count: number;
  pending: boolean;
  onDraft: (value: string | undefined) => void;
  onRename: (value: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const value = () => props.draft ?? props.label;
  const hasChanged = () => {
    const edited = props.draft;
    return (
      edited !== undefined &&
      edited.trim() !== '' &&
      edited.trim() !== props.label
    );
  };
  const commit = () => {
    if (!hasChanged() || props.pending) return;
    props.onRename(value().trim());
  };
  const cancel = () => props.onDraft(undefined);
  const isEditing = () => props.draft !== undefined;
  const isLastStage = () => props.count <= 1;
  const isFirst = () => props.index === 0;
  const isLast = () => props.index === props.count - 1;

  const reorderMode = useStageReorderMode();
  const [dndState] = useDragDropContext() ?? [];
  const sortable =
    reorderMode === 'drag'
      ? createSortable(props.id, {
          dragType: 'stage',
          overlayIcon: () => <StageIcon id={props.id} index={props.index} />,
          get name() {
            return props.label;
          },
        } satisfies StageDragData)
      : undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (props.pending) return;
    if (e.key === 'ArrowUp' && !isFirst()) props.onMove(-1);
    if (e.key === 'ArrowDown' && !isLast()) props.onMove(1);
  };

  return (
    <div
      ref={sortable?.ref}
      style={sortable ? maybeTransformStyle(sortable.transform) : undefined}
      class={cn(
        'flex min-h-12 items-center gap-3 px-4 py-2',
        // Shift rows out of the way while a drag is live; snap when it ends
        // so the settled order doesn't animate twice.
        !!dndState?.active.draggable && 'transition-transform',
        sortable?.isActiveDraggable && 'opacity-40'
      )}
    >
      <Show when={sortable}>
        <Tooltip label="Перетащите, чтобы изменить порядок, или используйте стрелки">
          <Button
            {...(sortable?.dragActivators ?? {})}
            aria-label={`Изменить порядок «${props.label}». Стрелки вверх и вниз перемещают этап.`}
            variant="ghost"
            size="icon-sm"
            class="-mx-1.5 cursor-grab touch-none text-ink-extra-muted active:cursor-grabbing"
            onKeyDown={handleKeyDown}
          >
            <DotsSixVerticalIcon class="size-4" />
          </Button>
        </Tooltip>
      </Show>
      <StageIcon id={props.id} index={props.index} />
      <InlineStageInput
        value={value()}
        label={`Переименовать «${props.label}»`}
        placeholder="Название этапа"
        onInput={(next) => props.onDraft(next)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          } else if (e.key === 'Escape') {
            cancel();
            e.currentTarget.blur();
          }
        }}
      />
      <div class="flex shrink-0 items-center gap-0.5">
        <Show when={isEditing()}>
          <Tooltip label="Сохранить">
            <Button
              aria-label="Сохранить название этапа"
              variant="primary"
              size="icon-sm"
              disabled={props.pending || !hasChanged()}
              onClick={commit}
            >
              <Show
                when={props.pending}
                fallback={<CheckIcon class="size-4" />}
              >
                <SpinnerIcon class="size-4 animate-spin" />
              </Show>
            </Button>
          </Tooltip>
          <Tooltip label="Отмена">
            <Button
              aria-label="Отменить переименование"
              variant="ghost"
              size="icon-sm"
              disabled={props.pending}
              onClick={cancel}
            >
              <XIcon class="size-4" />
            </Button>
          </Tooltip>
        </Show>
        <Show when={reorderMode === 'buttons'}>
          <Tooltip label="Выше">
            <Button
              aria-label={`Переместить «${props.label}» выше`}
              variant="ghost"
              size="icon-sm"
              disabled={props.pending || isFirst()}
              onClick={() => props.onMove(-1)}
            >
              <CaretUpIcon class="size-4" />
            </Button>
          </Tooltip>
          <Tooltip label="Ниже">
            <Button
              aria-label={`Переместить «${props.label}» ниже`}
              variant="ghost"
              size="icon-sm"
              disabled={props.pending || isLast()}
              onClick={() => props.onMove(1)}
            >
              <CaretDownIcon class="size-4" />
            </Button>
          </Tooltip>
        </Show>
        <Tooltip
          label={
            isLastStage() ? 'Нужен хотя бы один этап' : 'Удалить этап'
          }
        >
          <Button
            aria-label={`Удалить «${props.label}»`}
            variant="ghost"
            size="icon-sm"
            class="text-ink-extra-muted not-touch:hover:text-failure"
            disabled={props.pending || isLastStage()}
            onClick={() => props.onDelete()}
          >
            <TrashIcon class="size-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function StagesSection() {
  const dealStages = useDealStages();
  const crmPermissions = useCrmPermissions();
  const teamCrmConfig = useTeamCrmConfig();
  const replaceMutation = useReplaceCrmStagesMutation();
  const resetMutation = useResetCrmStagesMutation();

  const {
    newStageName,
    setNewStageName,
    stageToDelete,
    setStageToDelete,
    showResetModal,
    setShowResetModal,
    canEdit,
    pending,
    loading,
    failed,
    blocked,
    drafts,
    setDrafts,
    orderedStages,
    stageIds,
    announcement,
    handleCustomize,
    handleRename,
    reorder,
    handleMove,
    handleAddStage,
    handleDeleteStage,
    handleReset,
  } = createStageEditor({
    dealStages,
    crmPermissions,
    teamCrmConfig,
    replaceMutation,
    resetMutation,
    onSuccess: useCrmContext().feedback.success,
  });

  // Settings render inside the app-wide DragDropProvider (ItemDndProvider);
  // register on its events rather than mounting a nested provider.
  const [, dndActions] = useDragDropContext() ?? [];
  dndActions?.onDragEnd(({ draggable, droppable }) => {
    if (draggable.data.dragType !== 'stage') return;
    // Dropping outside the list leaves the order unchanged.
    if (!droppable || droppable.data.dragType !== 'stage') return;
    const ids = stageIds();
    reorder(
      ids.indexOf(String(draggable.id)),
      ids.indexOf(String(droppable.id))
    );
  });

  const editing = () => dealStages.isCustomized() && canEdit();
  const description = () => {
    const scope =
      'Варианты этапа у компаний. Новые воронки начинаются с этих этапов.';
    if (loading() || canEdit()) return scope;
    return crmPermissions.permissions().editStages === 'owner'
      ? `${scope} Менять их может только владелец команды.`
      : `${scope} Менять их могут только администраторы команды.`;
  };

  return (
    <SettingsSection
      title="Этапы"
      description={description()}
      actions={
        <Show when={canEdit() && !loading() && !failed()}>
          <Show
            when={dealStages.isCustomized()}
            fallback={
              <Button
                variant="secondary"
                size="sm"
                disabled={pending()}
                onClick={handleCustomize}
              >
                <Show when={pending()} fallback="Настроить">
                  <SpinnerIcon class="size-4 animate-spin" />
                </Show>
              </Button>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={blocked()}
              onClick={() => setShowResetModal(true)}
            >
              Вернуть по умолчанию
            </Button>
          </Show>
        </Show>
      }
    >
      <SettingsCard>
        <Switch>
          <Match when={failed()}>
            <div class="px-4 py-4 text-sm text-ink-muted">
              Не удалось загрузить этапы. Обновите страницу и попробуйте снова.
            </div>
          </Match>
          <Match when={loading()}>
            <div class="px-4 py-4">
              <ListSkeleton.Bar class="h-4 w-32" />
            </div>
          </Match>
          <Match when={editing()}>
            <StageList ids={stageIds()}>
              <For each={orderedStages()}>
                {(stage, index) => (
                  <StageEditorRow
                    id={stage.id}
                    label={stage.label}
                    draft={drafts[stage.id]}
                    index={index()}
                    count={orderedStages().length}
                    pending={pending()}
                    onDraft={(value) => setDrafts(stage.id, value)}
                    onRename={(label) => handleRename(index(), label)}
                    onMove={(direction) => handleMove(index(), direction)}
                    onDelete={() => setStageToDelete(stage)}
                  />
                )}
              </For>
            </StageList>
            <div class="flex min-h-12 items-center gap-3 px-4 py-2">
              <PlusIcon class="size-3.5 shrink-0 text-ink-muted" />
              <InlineStageInput
                value={newStageName()}
                label="Название нового этапа"
                placeholder="Добавить этап"
                onInput={setNewStageName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStage();
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                class="shrink-0"
                disabled={newStageName().trim() === '' || pending()}
                onClick={handleAddStage}
              >
                Добавить
              </Button>
            </div>
          </Match>
          <Match when={true}>
            <For each={dealStages.stages()}>
              {(stage, index) => (
                <StageRow id={stage.id} label={stage.label} index={index()} />
              )}
            </For>
          </Match>
        </Switch>
      </SettingsCard>
      <div aria-live="polite" class="sr-only">
        {announcement()}
      </div>

      <ConfirmDialog
        open={!!stageToDelete()}
        onOpenChange={(open) => !open && setStageToDelete(null)}
        title="Удалить этап"
        tone="danger"
        confirmLabel="Удалить"
        pending={replaceMutation.isPending}
        onConfirm={handleDeleteStage}
        body={
          <>
            Компании на этапе{' '}
            <span class="font-medium text-ink">
              {stageToDelete()?.label ?? ''}
            </span>{' '}
            теряют этап и показываются в «Без этапа». У воронок остаются свои
            этапы.
          </>
        }
      />

      <ConfirmDialog
        open={showResetModal()}
        onOpenChange={setShowResetModal}
        title="Сбросить этапы"
        tone="danger"
        confirmLabel="Вернуть по умолчанию"
        pending={resetMutation.isPending}
        onConfirm={handleReset}
        body={
          <>
            Команда возвращается к этапам Rox по умолчанию. У компаний
            сохраняются записанные значения этапов, а этапы с теми же
            названиями отображаются как раньше.
          </>
        }
      />
    </SettingsSection>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function NoTeamState() {
  return (
    <SettingsPage title="CRM">
      <SettingsSection>
        <SettingsCard>
          <div class="px-6 py-8 text-center text-sm text-ink-muted">
            Создайте команду или вступите в неё, чтобы настроить CRM.
          </div>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function CrmContent(props: { onOpenThread?: () => void }) {
  const teamQuery = useCurrentTeamQuery();

  return (
    <Show when={teamQuery.data} fallback={<NoTeamState />}>
      <SettingsPage
        title="CRM"
        description="Управляйте передачей почты и настройте воронку сделок команды."
      >
        <CrmEmailPrivacySettings onOpenThread={props.onOpenThread} />
        <StagesSection />
        <EmailSyncSection />
      </SettingsPage>
    </Show>
  );
}

export function Crm(props: { onOpenThread?: () => void }) {
  return (
    <Suspense fallback={<ListSkeleton.Bar class="m-6 h-4 w-32" />}>
      <CrmContent onOpenThread={props.onOpenThread} />
    </Suspense>
  );
}
