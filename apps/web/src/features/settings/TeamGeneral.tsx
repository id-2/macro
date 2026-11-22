import { toast } from '@core/component/Toast/Toast';
import {
  getLinkShareScope,
  LINK_SHARE_SCOPE_OPTIONS,
  type LinkShareScope,
  NO_LINK_SHARE,
} from '@core/component/TopBar/linkShare';
import { getWebOrigin } from '@core/util/webOrigin';
import CheckIcon from '@icon/system/regular/check.svg';
import CopyIcon from '@icon/system/regular/copy.svg';
import SpinnerIcon from '@icon/system/regular/spinner.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import XIcon from '@icon/system/regular/x.svg';
import {
  useDeleteTeamMutation,
  usePatchTeamMutation,
} from '@queries/team/teams';
import type { Team as TeamSummary } from '@service-auth/generated/schemas/team';
import { Button, Dialog, Panel, Tabs, Tooltip } from '@ui';
import { createSignal, Show } from 'solid-js';
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './primitives';
import { teamNameSchema, useTeamViewer } from './Team';
import {
  buildTeamTaskAutolinkTargetUrl,
  getTeamSlugError,
  normalizeTeamSlugInput,
} from './teamSlug';

/** Disabled field shown to non-owners, with a tooltip explaining why it's locked.
 *  The muted look comes from `settings-input`'s `:disabled` styling. */
function linkShareScopeLabel(scope: LinkShareScope): string {
  switch (scope) {
    case 'PUBLIC':
      return 'Все, у кого есть ссылка';
    case 'TEAM':
      return 'Участники команды по ссылке';
    default:
      return 'Только у кого есть доступ';
  }
}

function slugErrorText(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (error === 'team slug cannot be empty') {
    return 'Код команды не может быть пустым';
  }
  if (error.startsWith('team slug cannot be longer than ')) {
    const limit = error.match(/\d+/)?.[0] ?? '20';
    return `Код команды не может быть длиннее ${limit} символов`;
  }
  if (error.includes('may only contain')) {
    return 'Код команды может содержать только латинские буквы, пробелы, дефисы и подчёркивания';
  }
  return error;
}

function ReadOnlyField(props: { value: string; tooltip: string }) {
  return (
    <Tooltip label={props.tooltip} placement="top">
      <input
        type="text"
        value={props.value}
        disabled
        class="settings-input w-56 mobile:w-32"
      />
    </Tooltip>
  );
}

/** The Save / Cancel cluster shown while an inline field has unsaved changes. */
function SaveCancelButtons(props: {
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  pending?: boolean;
}) {
  return (
    <div class="flex items-center gap-1 shrink-0">
      <Tooltip label="Сохранить">
        <Button
          variant="primary"
          size="icon-sm"
          disabled={props.saveDisabled}
          onClick={props.onSave}
        >
          <Show when={props.pending} fallback={<CheckIcon class="size-4" />}>
            <SpinnerIcon class="size-4 animate-spin" />
          </Show>
        </Button>
      </Tooltip>
      <Tooltip label="Отмена">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={props.pending}
          onClick={props.onCancel}
        >
          <XIcon class="size-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

/** Team › General: name, slug, link sharing, and deletion. */
export function TeamGeneral(props: { team: TeamSummary }) {
  const { teamQuery, isOwner, isAdminOrOwner } = useTeamViewer(
    () => props.team
  );

  const patchTeamMutation = usePatchTeamMutation();
  const deleteTeamMutation = useDeleteTeamMutation();

  const [showDeleteTeamModal, setShowDeleteTeamModal] = createSignal(false);
  const [deleteConfirmation, setDeleteConfirmation] = createSignal('');
  const [editingTeamName, setEditingTeamName] = createSignal<
    string | undefined
  >(undefined);
  const [editingTeamSlug, setEditingTeamSlug] = createSignal<
    string | undefined
  >(undefined);
  const [teamSlugError, setTeamSlugError] = createSignal<string | undefined>(
    undefined
  );

  const deleteConfirmationPhrase = () => `Удалить ${props.team.name}`;
  const canDeleteTeam = () =>
    deleteConfirmation() === deleteConfirmationPhrase();

  const teamNameValue = () => editingTeamName() ?? props.team.name;
  const hasTeamNameChanged = () => {
    const editing = editingTeamName();
    return editing !== undefined && editing.trim() !== props.team.name;
  };

  const teamSlugValue = () => editingTeamSlug() ?? props.team.slug;
  const hasTeamSlugInputChanged = () => {
    const editing = editingTeamSlug();
    return editing !== undefined && editing !== props.team.slug;
  };
  const hasTeamSlugChanged = () => {
    const editing = editingTeamSlug();
    return (
      editing !== undefined &&
      normalizeTeamSlugInput(editing) !== props.team.slug
    );
  };
  const normalizedTeamSlugPreview = () => {
    const editing = editingTeamSlug();
    if (editing === undefined || !hasTeamSlugChanged()) return undefined;
    if (getTeamSlugError(editing)) return undefined;

    const normalized = normalizeTeamSlugInput(editing);
    return normalized === editing ? undefined : normalized;
  };
  const canSaveTeamSlug = () => {
    const editing = editingTeamSlug();
    return (
      editing !== undefined &&
      hasTeamSlugChanged() &&
      !patchTeamMutation.isPending &&
      getTeamSlugError(editing) === undefined
    );
  };

  // The team-wide default link-share scope for newly shared items. NONE
  // (stored as null) means link sharing starts off.
  const defaultLinkShare = () =>
    getLinkShareScope(teamQuery.data?.team.default_link_share);

  const handleChangeDefaultLinkShare = (scope: LinkShareScope) => {
    if (!props.team.id || patchTeamMutation.isPending) return;
    if (scope === defaultLinkShare()) return;
    patchTeamMutation.mutate({
      teamId: props.team.id,
      request: { default_link_share: scope === NO_LINK_SHARE ? null : scope },
    });
  };

  const handleSaveTeamName = () => {
    const newName = editingTeamName()?.trim();
    if (!props.team.id || !newName) return;

    // Validate against the same schema as the create flow (e.g. max length)
    // so rename can't push a name the create path would reject.
    const parsed = teamNameSchema.safeParse(newName);
    if (!parsed.success) return;

    patchTeamMutation.mutate(
      { teamId: props.team.id, request: { name: parsed.data } },
      { onSuccess: () => setEditingTeamName(undefined) }
    );
  };

  const handleCancelTeamNameEdit = () => {
    setEditingTeamName(undefined);
  };

  const validateTeamSlug = (slug: string) => {
    const error = getTeamSlugError(slug);
    setTeamSlugError(error);
    return error === undefined;
  };

  const handleTeamSlugChange = (slug: string) => {
    setEditingTeamSlug(slug);
    validateTeamSlug(slug);
  };

  const handleSaveTeamSlug = () => {
    const editedSlug = editingTeamSlug();
    if (!props.team.id || editedSlug === undefined) return;
    if (!validateTeamSlug(editedSlug) || !hasTeamSlugChanged()) return;

    // Persist the normalized slug so the saved value matches the "Will save as"
    // preview (and the backend's UPPERCASE_UNDERSCORE format).
    patchTeamMutation.mutate(
      {
        teamId: props.team.id,
        request: { slug: normalizeTeamSlugInput(editedSlug) },
      },
      {
        onSuccess: () => {
          setEditingTeamSlug(undefined);
          setTeamSlugError(undefined);
        },
      }
    );
  };

  const handleCancelTeamSlugEdit = () => {
    setEditingTeamSlug(undefined);
    setTeamSlugError(undefined);
  };

  const handleCopyGithubAutolinkUrl = async () => {
    const targetUrl = buildTeamTaskAutolinkTargetUrl(
      props.team.slug,
      getWebOrigin()
    );
    try {
      await navigator.clipboard.writeText(targetUrl);
      toast.success('Адрес автоссылки GitHub скопирован');
    } catch (error) {
      console.error('Failed to copy GitHub autolink URL', error);
      toast.failure('Не удалось скопировать адрес автоссылки GitHub');
    }
  };

  const handleDeleteTeam = () => {
    if (!props.team.id) return;

    deleteTeamMutation.mutate(
      { teamId: props.team.id },
      {
        onSuccess: () => {
          setDeleteConfirmation('');
          setShowDeleteTeamModal(false);
        },
      }
    );
  };

  const handleDeleteTeamModalClose = (open: boolean) => {
    if (!open) {
      setDeleteConfirmation('');
      setShowDeleteTeamModal(false);
    }
  };

  return (
    <>
      <SettingsPage
        title="Команда"
        actions={
          <Show when={isOwner()}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteTeamModal(true)}
            >
              <TrashIcon class="size-4" />
              Удалить команду
            </Button>
          </Show>
        }
      >
        <SettingsSection title="Общие">
          <SettingsCard>
            <SettingsRow
              label="Название"
              description="Как называется команда — видно в приглашениях и в оплате."
              hideDescriptionOnMobile
            >
              <Show
                when={isOwner()}
                fallback={
                  <ReadOnlyField
                    value={props.team.name}
                    tooltip="Название команды может менять только владелец."
                  />
                }
              >
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    value={teamNameValue()}
                    onInput={(e) => setEditingTeamName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (hasTeamNameChanged() && editingTeamName()?.trim()) {
                          handleSaveTeamName();
                        }
                      } else if (e.key === 'Escape') {
                        handleCancelTeamNameEdit();
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Введите название команды"
                    class="settings-input w-56 mobile:w-32"
                  />
                  <Show when={hasTeamNameChanged()}>
                    <SaveCancelButtons
                      onSave={handleSaveTeamName}
                      onCancel={handleCancelTeamNameEdit}
                      saveDisabled={
                        patchTeamMutation.isPending ||
                        !editingTeamName()?.trim()
                      }
                      pending={patchTeamMutation.isPending}
                    />
                  </Show>
                </div>
              </Show>
            </SettingsRow>

            <SettingsRow
              label="Код"
              description="Короткий код в ссылках на задачи, например ENG-42 (GitHub и имена веток)."
              hideDescriptionOnMobile
            >
              <Show
                when={isOwner()}
                fallback={
                  <ReadOnlyField
                    value={props.team.slug}
                    tooltip="Код команды может менять только владелец."
                  />
                }
              >
                <div class="flex items-center gap-2">
                  <div class="flex flex-col items-end gap-1 min-w-0">
                    <input
                      type="text"
                      value={teamSlugValue()}
                      onInput={(e) =>
                        handleTeamSlugChange(e.currentTarget.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (canSaveTeamSlug()) handleSaveTeamSlug();
                        } else if (e.key === 'Escape') {
                          handleCancelTeamSlugEdit();
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Введите код команды"
                      class="settings-input w-56 mobile:w-32"
                      aria-invalid={!!teamSlugError()}
                    />
                    <Show when={teamSlugError()}>
                      <p class="text-xs text-failure-ink text-right">
                        {slugErrorText(teamSlugError())}
                      </p>
                    </Show>
                    <Show when={normalizedTeamSlugPreview()}>
                      <p class="text-xs text-ink-muted text-right">
                        Будет сохранено как {normalizedTeamSlugPreview()}
                      </p>
                    </Show>
                  </div>
                  <Show when={hasTeamSlugInputChanged()}>
                    <SaveCancelButtons
                      onSave={handleSaveTeamSlug}
                      onCancel={handleCancelTeamSlugEdit}
                      saveDisabled={!canSaveTeamSlug()}
                      pending={patchTeamMutation.isPending}
                    />
                  </Show>
                </div>
              </Show>
            </SettingsRow>

            <SettingsRow
              label="Автоссылка GitHub"
              description={
                <>
                  В GitHub укажите префикс <code>{props.team.slug}-</code>, затем
                  вставьте этот адрес.
                </>
              }
              hideDescriptionOnMobile
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyGithubAutolinkUrl}
              >
                <CopyIcon class="size-4" />
                Копировать адрес
              </Button>
            </SettingsRow>

            <Show when={isAdminOrOwner()}>
              <SettingsRow
                label="Доступ по ссылке по умолчанию"
                description="Область доступа по ссылке для новых общих элементов. «Только у кого есть доступ» — доступ по ссылке выключен."
                hideDescriptionOnMobile
              >
                <Tabs
                  touch="segmented"
                  aria-label="Область доступа по ссылке по умолчанию"
                  size="sm"
                  value={defaultLinkShare()}
                  options={LINK_SHARE_SCOPE_OPTIONS.map((option) => ({
                    ...option,
                    label: linkShareScopeLabel(option.value),
                    disabled:
                      patchTeamMutation.isPending || teamQuery.isLoading,
                  }))}
                  onChange={handleChangeDefaultLinkShare}
                />
              </SettingsRow>
            </Show>
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>

      <Dialog
        open={showDeleteTeamModal()}
        onOpenChange={handleDeleteTeamModalClose}
      >
        <Panel depth={2} class="max-h-[75vh] text-ink rounded-xl">
          <Panel.Header class="px-2 gap-1">
            <Dialog.CloseButton as={Button} variant="ghost" size="icon-sm">
              <XIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
            </Dialog.CloseButton>
            <Dialog.Title as="span" class="text-sm font-medium p-0 m-0">
              Удалить команду
            </Dialog.Title>
          </Panel.Header>
          <Panel.Body class="p-3 flex flex-col gap-3">
            <p>
              Вы уверены, что хотите удалить{' '}
              <span class="font-medium">{props.team.name}</span>? Это действие
              нельзя отменить, и все участники потеряют доступ.
            </p>
            <p class="text-sm text-ink-muted">
              Введите{' '}
              <span class="font-medium text-ink">
                {deleteConfirmationPhrase()}
              </span>
              , чтобы подтвердить.
            </p>
            <input
              type="text"
              value={deleteConfirmation()}
              onInput={(e) => setDeleteConfirmation(e.currentTarget.value)}
              placeholder={deleteConfirmationPhrase()}
              class="settings-input w-full"
            />
            <div class="flex justify-end gap-1 pt-2">
              <Button
                variant="ghost"
                disabled={deleteTeamMutation.isPending}
                onClick={() => handleDeleteTeamModalClose(false)}
              >
                Отмена
              </Button>
              <Button
                variant="secondary"
                disabled={!canDeleteTeam() || deleteTeamMutation.isPending}
                onClick={handleDeleteTeam}
              >
                <Show
                  when={deleteTeamMutation.isPending}
                  fallback="Удалить команду"
                >
                  <SpinnerIcon class="size-4 animate-spin" />
                </Show>
              </Button>
            </div>
          </Panel.Body>
        </Panel>
      </Dialog>
    </>
  );
}
