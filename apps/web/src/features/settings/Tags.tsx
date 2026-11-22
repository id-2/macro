import PencilIcon from '@icon/system/regular/pencil-simple.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import SpinnerIcon from '@icon/system/regular/spinner.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import UsersIcon from '@icon/system/regular/users-three.svg';
import XIcon from '@icon/system/regular/x.svg';
import { TagDot } from '@property/tags/TagDot';
import {
  type EditableTag,
  TagEditorDialog,
  type TagEditorDialogMode,
} from '@property/tags/TagEditorDialog';
import { useTagTeamSharingFlag } from '@property/tags/use-tag-team-sharing-flag';
import {
  useDeletePropertyOptionMutation,
  useMergeTagMutation,
  usePromoteTagMutation,
  useTagsQuery,
} from '@queries/properties/tags';
import { useCurrentTeamQuery } from '@queries/team/teams';
import { parseTagNameConflict } from '@service-properties/client';
import type { PropertyOptionResponse } from '@service-properties/generated/schemas/propertyOptionResponse';
import type { TagScope } from '@service-properties/generated/schemas/tagScope';
import type { TagSetResponse } from '@service-properties/generated/schemas/tagSetResponse';
import { Button, Dialog, Panel } from '@ui';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { SettingsCard, SettingsPage, SettingsSection } from './primitives';

function optionLabel(option: PropertyOptionResponse | undefined): string {
  return option?.value.type === 'string' ? option.value.value : '';
}

function sortedOptions(set: TagSetResponse | undefined) {
  return [...(set?.options ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

function tagForOption(
  scope: TagScope,
  set: TagSetResponse,
  option: PropertyOptionResponse
): EditableTag {
  return {
    scope,
    propertyDefinitionId: set.definition?.id ?? option.propertyDefinitionId,
    option,
  };
}

/** A pending share blocked by a same-named team label. */
type ShareConflict = {
  tag: EditableTag;
  conflictingOption: PropertyOptionResponse;
};

function EmptyTagRows(props: { scope: TagScope }) {
  return (
    <div class="px-6 py-8 text-center text-sm text-ink-extra-muted">
      {props.scope === 'team' ? 'Нет командных тегов' : 'Нет личных тегов'}
    </div>
  );
}

function TagListSection(props: {
  title: string;
  description?: string;
  scope: TagScope;
  set: TagSetResponse | undefined;
  onCreate: (scope: TagScope) => void;
  onEdit: (tag: EditableTag) => void;
  onDelete: (tag: EditableTag) => void;
  /** Omitted when the tag can't be shared (team scope, no team, flag off). */
  onShare?: (tag: EditableTag) => void;
  deleting?: boolean;
  sharingOptionId?: string;
}) {
  const options = createMemo(() => sortedOptions(props.set));
  const editable = () => Boolean(props.set?.definition);

  return (
    <SettingsSection
      title={props.title}
      description={props.description}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => props.onCreate(props.scope)}
        >
          <PlusIcon class="size-4" />
          Новый тег
        </Button>
      }
    >
      <SettingsCard>
        <Show
          when={options().length > 0}
          fallback={<EmptyTagRows scope={props.scope} />}
        >
          <For each={options()}>
            {(option) => (
              <div class="flex min-h-14 items-center gap-3 px-6 py-3">
                <TagDot color={option.color ?? undefined} class="size-3" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-ink">
                    {optionLabel(option)}
                  </div>
                </div>
                <Show when={editable() && props.set}>
                  {(set) => {
                    const tag = () => tagForOption(props.scope, set(), option);
                    return (
                      <div class="flex shrink-0 items-center gap-1">
                        <Show when={props.onShare}>
                          {(onShare) => (
                            <Button
                              aria-label={`Поделиться «${optionLabel(option)}» с командой`}
                              variant="ghost"
                              size="icon-sm"
                              tooltip="Поделиться с командой"
                              disabled={
                                props.deleting ||
                                props.sharingOptionId !== undefined
                              }
                              onClick={() => onShare()(tag())}
                            >
                              <Show
                                when={props.sharingOptionId === option.id}
                                fallback={<UsersIcon class="size-4" />}
                              >
                                <SpinnerIcon class="size-4 animate-spin" />
                              </Show>
                            </Button>
                          )}
                        </Show>
                        <Button
                          aria-label={`Изменить «${optionLabel(option)}»`}
                          variant="ghost"
                          size="icon-sm"
                          tooltip="Изменить тег"
                          disabled={props.deleting}
                          onClick={() => props.onEdit(tag())}
                        >
                          <PencilIcon class="size-3.5 touch:size-4" />
                        </Button>
                        <Button
                          aria-label={`Удалить «${optionLabel(option)}»`}
                          variant="ghost"
                          size="icon-sm"
                          tooltip="Удалить тег"
                          disabled={props.deleting}
                          onClick={() => props.onDelete(tag())}
                        >
                          <TrashIcon class="size-3.5 touch:size-4" />
                        </Button>
                      </div>
                    );
                  }}
                </Show>
              </div>
            )}
          </For>
        </Show>
      </SettingsCard>
    </SettingsSection>
  );
}

/** Panel-shaped confirm dialog, matching the Team tab's action dialogs. */
function ConfirmDialog(props: {
  open: boolean;
  title: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: JSX.Element;
}) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && !props.pending && props.onClose()}
    >
      <Panel depth={2} class="max-h-[75vh] rounded-xl text-ink">
        <Panel.Header class="gap-1 px-2">
          <Dialog.CloseButton
            as={Button}
            variant="ghost"
            size="icon-sm"
            disabled={props.pending}
          >
            <XIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
          </Dialog.CloseButton>
          <Dialog.Title as="span" class="m-0 p-0 text-sm font-medium">
            {props.title}
          </Dialog.Title>
        </Panel.Header>
        <Panel.Body class="flex flex-col gap-3 p-3">
          <p class="text-sm text-ink-muted">{props.children}</p>
          <div class="flex justify-end gap-1 pt-2">
            <Button
              variant="ghost"
              disabled={props.pending}
              onClick={props.onClose}
            >
              Отмена
            </Button>
            <Button
              variant="secondary"
              disabled={props.pending}
              onClick={props.onConfirm}
            >
              <Show when={props.pending} fallback={props.confirmLabel}>
                <SpinnerIcon class="size-4 animate-spin" />
              </Show>
            </Button>
          </div>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}

export function Tags() {
  const tagsQuery = useTagsQuery();
  const teamQuery = useCurrentTeamQuery();
  const deleteTag = useDeletePropertyOptionMutation();
  const promoteTag = usePromoteTagMutation();
  const mergeTag = useMergeTagMutation();
  const teamSharingEnabled = useTagTeamSharingFlag();
  const [editorMode, setEditorMode] = createSignal<TagEditorDialogMode | null>(
    null
  );
  const [sharingOptionId, setSharingOptionId] = createSignal<string>();
  const [pendingShare, setPendingShare] = createSignal<EditableTag | null>(
    null
  );
  const [conflict, setConflict] = createSignal<ShareConflict | null>(null);

  const tagSet = (scope: TagScope) =>
    tagsQuery.data?.find((set) => set.scope === scope);
  const teamName = () => teamQuery.data?.team.name?.trim() || 'Команда';
  const hasTeam = () =>
    tagsQuery.data?.some((set) => set.scope === 'team') ||
    Boolean(teamQuery.data?.team);

  const openCreate = (scope: TagScope) => {
    setEditorMode({ type: 'create', initialScope: scope });
  };

  const openEdit = (tag: EditableTag) => {
    setEditorMode({ type: 'edit', tag });
  };

  const removeTag = (tag: EditableTag) => {
    deleteTag.mutate({
      propertyDefinitionId: tag.propertyDefinitionId,
      optionId: tag.option.id,
    });
  };

  // Promotion is one-way — there is no un-share endpoint — so it is confirmed
  // before anything moves.
  const shareTag = (tag: EditableTag) => setPendingShare(tag);

  const confirmShare = () => {
    const tag = pendingShare();
    if (!tag) return;

    setSharingOptionId(tag.option.id);
    promoteTag.mutate(
      { optionId: tag.option.id },
      {
        onSettled: () => setSharingOptionId(undefined),
        onSuccess: () => setPendingShare(null),
        onError: (error) => {
          // The mutation stays silent on a name collision so it can be turned
          // into a prompt here; every other failure already toasted.
          const detected = parseTagNameConflict(error);
          setPendingShare(null);
          if (detected) {
            setConflict({
              tag,
              conflictingOption: detected.conflicting_option,
            });
          }
        },
      }
    );
  };

  const confirmMerge = () => {
    const pending = conflict();
    if (!pending) return;

    mergeTag.mutate(
      {
        optionId: pending.tag.option.id,
        targetOptionId: pending.conflictingOption.id,
      },
      {
        onSuccess: () => setConflict(null),
      }
    );
  };

  // Sharing needs a team to share into, and only personal labels can move.
  const canShare = () => teamSharingEnabled() && hasTeam();

  return (
    <SettingsPage
      title="Теги"
      description="Управляйте личными тегами и общими тегами команды."
      actions={
        <Button variant="primary" size="sm" onClick={() => openCreate('user')}>
          <PlusIcon class="size-4" />
          Новый тег
        </Button>
      }
    >
      <TagListSection
        title="Личные"
        scope="user"
        set={tagSet('user')}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={removeTag}
        onShare={canShare() ? shareTag : undefined}
        sharingOptionId={sharingOptionId()}
        deleting={deleteTag.isPending}
      />
      <Show when={hasTeam()}>
        <TagListSection
          title="Команда"
          description={teamName()}
          scope="team"
          set={tagSet('team')}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={removeTag}
          deleting={deleteTag.isPending}
        />
      </Show>

      <TagEditorDialog
        open={editorMode() !== null}
        mode={editorMode()}
        teamAvailable={hasTeam()}
        onClose={() => setEditorMode(null)}
      />

      <ConfirmDialog
        open={pendingShare() !== null}
        title="Поделиться с командой"
        confirmLabel="Поделиться"
        pending={promoteTag.isPending}
        onConfirm={confirmShare}
        onClose={() => setPendingShare(null)}
      >
        <span class="font-medium text-ink">
          {optionLabel(pendingShare()?.option)}
        </span>{' '}
        перейдёт в набор тегов команды {teamName()}. Это действие нельзя
        отменить.
      </ConfirmDialog>

      <ConfirmDialog
        open={conflict() !== null}
        title="Тег команды уже существует"
        confirmLabel="Использовать тег команды"
        pending={mergeTag.isPending}
        onConfirm={confirmMerge}
        onClose={() => setConflict(null)}
      >
        У команды уже есть тег{' '}
        <span class="font-medium text-ink">
          {optionLabel(conflict()?.conflictingOption)}
        </span>. Всё, что помечено вашим личным тегом, будет перенесено на
        командный, а личный тег будет удалён. Это действие нельзя отменить.
      </ConfirmDialog>
    </SettingsPage>
  );
}
