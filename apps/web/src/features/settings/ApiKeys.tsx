import { CredentialField } from '@channel/Bots/CredentialField';
import { LoadingSpinner } from '@core/component/LoadingSpinner';
import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { formatRelativeTimestamp } from '@entity';
import KeyIcon from '@icon/system/regular/key.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import SpinnerIcon from '@icon/system/regular/spinner.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import XIcon from '@icon/system/regular/x.svg';
import {
  MAX_USER_API_KEYS,
  normalizeUserApiKeyName,
} from '@queries/user-api-keys/name';
import {
  useCreateUserApiKeyMutation,
  useDeleteUserApiKeyMutation,
  useUserApiKeysQuery,
} from '@queries/user-api-keys/user-api-keys';
import type { CreatedUserApiKey } from '@service-storage/generated/schemas/createdUserApiKey';
import type { UserApiKeyInfo } from '@service-storage/generated/schemas/userApiKeyInfo';
import { Button, Dialog, Panel, Tooltip } from '@ui';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { SettingsCard, SettingsPage, SettingsSection } from './primitives';

const USER_API_KEY_HEADER = 'x-rox-user-api-key';

export function ApiKeys() {
  const keysQuery = useUserApiKeysQuery();
  const createKey = useCreateUserApiKeyMutation();
  const deleteKey = useDeleteUserApiKeyMutation();
  const [createOpen, setCreateOpen] = createSignal(false);
  const [pendingDelete, setPendingDelete] = createSignal<UserApiKeyInfo | null>(
    null
  );

  const keys = () => keysQuery.data ?? [];
  const atLimit = () => keys().length >= MAX_USER_API_KEYS;
  const createDisabled = () => keysQuery.isLoading || atLimit();

  const openCreate = () => {
    if (createDisabled()) return;
    setCreateOpen(true);
  };

  return (
    <SettingsPage
      title="Ключи API"
      description={
        <>
          Входите от своего имени из скриптов и интеграций. Передавайте ключ
          в заголовке <code class="font-mono text-xs">{USER_API_KEY_HEADER}</code>.
          Секрет показывается только один раз, когда вы создаёте ключ.
        </>
      }
      actions={
        <Tooltip
          label={`Можно иметь не больше ${MAX_USER_API_KEYS} ключей API`}
          disabled={!atLimit()}
        >
          <Button
            variant="primary"
            size="sm"
            disabled={createDisabled()}
            onClick={openCreate}
          >
            <PlusIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
            Создать ключ
          </Button>
        </Tooltip>
      }
    >
      <SettingsSection
        title="Ваши ключи"
        description={`Не больше ${MAX_USER_API_KEYS} ключей. Любой, у кого есть ключ, может действовать от вашего имени, поэтому храните их как пароли.`}
      >
        <SettingsCard>
          <Show
            when={!keysQuery.isLoading}
            fallback={
              <div class="flex min-h-36 items-center justify-center">
                <LoadingSpinner class="size-10 p-2" />
              </div>
            }
          >
            <Show
              when={!keysQuery.isError}
              fallback={
                <div class="px-6 py-8 text-center text-sm text-ink-muted">
                  Не удалось загрузить ключи API.
                </div>
              }
            >
              <Show
                when={keys().length > 0}
                fallback={
                  <div class="flex min-h-52 flex-col items-center justify-center px-8 text-center">
                    <div class="flex size-11 items-center justify-center rounded-xl bg-accent-bg text-accent">
                      <KeyIcon class="size-6" />
                    </div>
                    <div class="mt-3 text-sm font-medium text-ink">
                      Создайте первый ключ API
                    </div>
                    <div class="mt-1 max-w-80 text-xs text-ink-muted">
                      Ключ позволяет обращаться к Rox от вашего имени. Полный
                      секрет показывается только при создании.
                    </div>
                    <Button
                      class="mt-4"
                      variant="primary"
                      size="sm"
                      onClick={openCreate}
                    >
                      <PlusIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
                      Создать ключ
                    </Button>
                  </div>
                }
              >
                <For each={keys()}>
                  {(key) => (
                    <ApiKeyRow
                      keyInfo={key}
                      deleting={
                        deleteKey.isPending && pendingDelete()?.id === key.id
                      }
                      onDelete={() => setPendingDelete(key)}
                    />
                  )}
                </For>
              </Show>
            </Show>
          </Show>
        </SettingsCard>
      </SettingsSection>

      <CreateApiKeyDialog
        open={createOpen()}
        pending={createKey.isPending}
        onCreate={async (name) => {
          try {
            return await createKey.mutateAsync({ name });
          } catch (error) {
            toast.failure(
              error instanceof Error
                ? error.message
                : 'Не удалось создать ключ API'
            );
            return undefined;
          }
        }}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmDialog
        open={pendingDelete() !== null}
        title="Удалить ключ API"
        confirmLabel="Удалить ключ"
        pending={deleteKey.isPending}
        danger
        onConfirm={async () => {
          const key = pendingDelete();
          if (!key) return;
          try {
            await deleteKey.mutateAsync({ id: key.id });
            toast.success('Ключ API удалён');
            setPendingDelete(null);
          } catch {
            toast.failure('Не удалось удалить ключ API');
          }
        }}
        onClose={() => !deleteKey.isPending && setPendingDelete(null)}
      >
        <Show when={pendingDelete()}>
          {(key) => (
            <>
              Удалить <span class="font-medium text-ink">{key().name}</span>?
              Это нельзя отменить. Всё, что использует этот ключ, перестанет работать.
            </>
          )}
        </Show>
      </ConfirmDialog>
    </SettingsPage>
  );
}

function ApiKeyRow(props: {
  keyInfo: UserApiKeyInfo;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div class="flex min-h-14 items-center gap-3 px-6 py-3.5">
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-ink">
          {props.keyInfo.name}
        </div>
        <div
          class="mt-0.5 text-xs text-ink-extra-muted"
          title={props.keyInfo.createdAt}
        >
          Создан {formatRelativeTimestamp(props.keyInfo.createdAt)}
        </div>
      </div>
      <Button
        aria-label={`Удалить ${props.keyInfo.name}`}
        variant="ghost"
        size="icon-sm"
        tooltip="Удалить ключ"
        disabled={props.deleting}
        onClick={props.onDelete}
      >
        <Show
          when={props.deleting}
          fallback={<TrashIcon class="size-3.5 touch:size-4" />}
        >
          <SpinnerIcon class="animate-spin size-3.5 touch:size-6 shrink-0 pointer-events-none" />
        </Show>
      </Button>
    </div>
  );
}

function CreateApiKeyDialog(props: {
  open: boolean;
  pending: boolean;
  onCreate: (name: string) => Promise<CreatedUserApiKey | undefined>;
  onClose: () => void;
}) {
  const [name, setName] = createSignal('');
  const [created, setCreated] = createSignal<CreatedUserApiKey>();
  const [nameError, setNameError] = createSignal<string>();
  let nameInputRef: HTMLInputElement | undefined;

  const reset = () => {
    setName('');
    setCreated(undefined);
    setNameError(undefined);
  };

  const close = () => {
    if (props.pending) return;
    props.onClose();
    reset();
  };

  const submit = async () => {
    if (props.pending || created()) return;
    const normalized = normalizeUserApiKeyName(name());
    if (!normalized.ok) {
      setNameError(normalized.error);
      return;
    }
    setNameError(undefined);
    const result = await props.onCreate(normalized.name);
    if (result) setCreated(result);
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => (open ? undefined : close())}
      onEscapeKeyDown={(event) => props.pending && event.preventDefault()}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        nameInputRef?.focus();
      }}
      position="center"
      class="w-105"
    >
      <Panel depth={2} active class="rounded-xl text-ink">
        <Panel.Header class="px-5">
          <Dialog.Title class="text-sm font-semibold">
            {created() ? 'Ключ API создан' : 'Новый ключ API'}
          </Dialog.Title>
          <div class="ml-auto">
            <Button
              tooltip="Закрыть"
              variant="ghost"
              size="icon-sm"
              aria-label="Закрыть"
              disabled={props.pending}
              onClick={close}
            >
              <XIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
            </Button>
          </div>
        </Panel.Header>
        <Panel.Body class="p-5">
          <Show
            when={created()}
            fallback={
              <div class="flex flex-col gap-5">
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-medium text-ink">Имя</span>
                  <input
                    ref={nameInputRef}
                    value={name()}
                    placeholder="например, CI, локальные скрипты"
                    class="settings-input w-full"
                    aria-invalid={nameError() ? true : undefined}
                    onInput={(event) => {
                      setName(event.currentTarget.value);
                      setNameError(undefined);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter')
                        fireAndForget(submit(), 'api-key-settings');
                    }}
                  />
                  <Show
                    when={nameError()}
                    fallback={
                      <span class="text-xs text-ink-muted">
                        Подпись, чтобы потом отличать ключи друг от друга.
                      </span>
                    }
                  >
                    {(error) => (
                      <span class="text-xs text-failure">{error()}</span>
                    )}
                  </Show>
                </label>
                <div class="flex justify-end gap-2 border-t border-edge-muted pt-4">
                  <Button variant="ghost" size="sm" onClick={close}>
                    Отмена
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={props.pending}
                    onClick={() => fireAndForget(submit(), 'api-key-settings')}
                  >
                    {props.pending ? 'Создание…' : 'Создать ключ'}
                  </Button>
                </div>
              </div>
            }
          >
            {(key) => (
              <div class="flex flex-col gap-5">
                <CredentialField
                  label="Ключ API"
                  value={key().key}
                  help="Показывается только один раз"
                />
                <div class="rounded-lg border border-alert/30 bg-alert-bg px-3 py-2.5 text-xs text-alert-ink">
                  Сохраните ключ в надёжном месте, прежде чем закрыть окно. Передавайте его как{' '}
                  <code class="font-mono">{USER_API_KEY_HEADER}</code>.
                </div>
                <div class="flex justify-end border-t border-edge-muted pt-4">
                  <Button variant="secondary" size="sm" onClick={close}>
                    Готово
                  </Button>
                </div>
              </div>
            )}
          </Show>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}

function ConfirmDialog(props: {
  open: boolean;
  title: string;
  confirmLabel: string;
  pending: boolean;
  danger?: boolean;
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
              variant={props.danger ? 'danger' : 'primary'}
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
