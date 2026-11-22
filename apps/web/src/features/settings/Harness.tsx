import { TutorialPill } from '@app/features/video-tutorials';
import { useCodexAgentsAccess } from '@core/codex/flag';
import { toast } from '@core/component/Toast/Toast';
import { MACRO_HARNESS_NAME } from '@core/constant/macroAgent';
import { fireAndForget } from '@core/util/fireAndForget';
import { ThrownResultError, thrownResultErrorHasCode } from '@core/util/result';
import HardDrivesIcon from '@icon/system/regular/hard-drives.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import CursorIcon from '@icon/wide-cursor-ide.svg';
import {
  useCursorApiKeyStatusQuery,
  useDisconnectCursorApiKey,
  useSaveCursorApiKey,
} from '@queries/auth/cursor-api-key';
import {
  invalidateHarnesses,
  useDeleteHarnessMutation,
  useHarnessesQuery,
  usePatchHarnessMutation,
} from '@queries/harnesses/harnesses';
import { isTeamAgentComputer } from '@queries/harnesses/runnable';
import { useIsTeamOwner } from '@queries/team/teams';
import type { Harness as RegisteredHarness } from '@service-storage/client';
import { useSearchParams } from '@solidjs/router';
import { ApiKeyInput, Button, confirmDialog, Dialog, Input, Panel } from '@ui';
import { createEffect, createSignal, on, onMount, Show } from 'solid-js';
import { CodexHarness } from './codex/views/CodexHarness';
import {
  ConnectedRuntimesSection,
  MachineSection,
} from './components/connected-runtimes-section';
import { CursorDefaultModel } from './components/cursor-default-model';
import { LocalRuntimeCard } from './components/local-runtime-card';
import { PendingRequestsSection } from './components/pending-requests-section';
import { SettingsSearchTarget } from './components/settings-search-target';
import { TeammateRuntimesSection } from './components/teammate-runtimes-section';
import {
  COMPUTER_SETUP_PARAM,
  parseComputerSetupParam,
  requestComputerSetup,
} from './computers/primitives/setup-request';
import { useTeamComputers } from './computers/primitives/team-computers';
import { GetComputerEntry } from './computers/views/get-computer-entry';
import { MacroComputers } from './computers/views/MacroComputers';
import {
  CURSOR_KEY_FORMAT_ERROR,
  CURSOR_KEY_PREFIX,
  isCursorApiKey,
} from './core/cursor-api-key';
import { HarnessIcon } from './integration-ui';
import { SettingsCard, SettingsPage } from './primitives';
import { RuntimePairingPage } from './RuntimePairingPage';
import {
  consumeRuntimeShareRequest,
  runtimeShareRequest,
} from './runtimeSettingsState';

function failureMessage(error: unknown, fallback: string): string {
  return (error instanceof ThrownResultError && error.message) || fallback;
}

/** Settings UI for choosing and configuring the available agent harnesses. */
export function Harness(
  props: { onBack?: () => void; backLabel?: string } = {}
) {
  const canUseCodex = useCodexAgentsAccess();
  const [cursorApiKey, setCursorApiKey] = createSignal('');
  const cursorStatus = useCursorApiKeyStatusQuery();
  const saveCursorApiKey = useSaveCursorApiKey();
  const disconnectCursor = useDisconnectCursorApiKey();
  const cursorRegistered = () =>
    cursorStatus.isSuccess ? cursorStatus.data.registered : false;
  const harnessesQuery = useHarnessesQuery();
  const harnesses = () => (harnessesQuery.isSuccess ? harnessesQuery.data : []);
  const teamComputers = useTeamComputers();
  const computerHarnessIds = () =>
    new Set(
      teamComputers
        .computers()
        .flatMap((computer) => (computer.harnessId ? [computer.harnessId] : []))
    );
  const isTeamOwner = useIsTeamOwner();
  const deleteHarnessMutation = useDeleteHarnessMutation();
  const [pairingDialog, setPairingDialog] = createSignal<
    | {
        initialCode?: string;
      }
    | undefined
  >(undefined);
  const closePairing = () => {
    setPairingDialog(undefined);
  };
  const [removingHarness, setRemovingHarness] =
    createSignal<RegisteredHarness>();
  const [renamingHarness, setRenamingHarness] =
    createSignal<RegisteredHarness>();
  const [searchParams, setSearchParams] = useSearchParams();

  // The runtime the page points out, and the one whose Share menu is open.
  const [highlight, setHighlight] = createSignal<{ target: string }>();
  const [sharing, setSharing] = createSignal<string>();
  const [buyingComputer, setBuyingComputer] = createSignal(false);
  // Opened from an access-request notification: point out that runtime and,
  // for a request, open its Share menu, where the request waits.
  createEffect(
    on(runtimeShareRequest, (request) => {
      if (!request) return;
      setHighlight({ target: `runtime-${request.harnessId}` });
      if (request.share) setSharing(request.harnessId);
      consumeRuntimeShareRequest(request.id);
    })
  );

  onMount(() => {
    const pair = searchParams.pair;
    if (typeof pair === 'string' && pair.length > 0) {
      setPairingDialog({ initialCode: pair });
      setSearchParams({ pair: undefined }, { replace: true });
    }
    // A computer setup notification's link, opened cold.
    const computerId = parseComputerSetupParam(
      searchParams[COMPUTER_SETUP_PARAM]
    );
    if (computerId) {
      requestComputerSetup(computerId);
      setSearchParams({ [COMPUTER_SETUP_PARAM]: undefined }, { replace: true });
    }
  });

  // Set synchronously, before the mutation's own pending state renders, so a
  // second click cannot send a second DELETE for a row that is already gone.
  const [removing, setRemoving] = createSignal(false);
  const removeHarness = async () => {
    const current = removingHarness();
    if (!current || removing()) return;
    setRemoving(true);
    try {
      await deleteHarnessMutation.mutateAsync({ harnessId: current.id });
      setRemovingHarness(undefined);
      toast.success('Машина удалена');
    } catch (error) {
      if (thrownResultErrorHasCode(error, 'NOT_FOUND')) {
        // Already gone, e.g. removed elsewhere: the list just needs to catch up.
        setRemovingHarness(undefined);
        fireAndForget(invalidateHarnesses(), 'harness-settings');
        return;
      }
      toast.failure(failureMessage(error, 'Не удалось удалить машину'));
    } finally {
      setRemoving(false);
    }
  };

  const handleSaveCursorApiKey = async () => {
    const apiKey = cursorApiKey().trim();
    if (!isCursorApiKey(apiKey)) {
      toast.failure(CURSOR_KEY_FORMAT_ERROR);
      return;
    }

    try {
      await saveCursorApiKey.mutateAsync(apiKey);
      setCursorApiKey('');
      toast.success('Cursor подключён');
    } catch (error) {
      toast.failure(
        failureMessage(error, 'Не удалось сохранить ключ API Cursor')
      );
    }
  };

  const handleDisconnectCursor = async () => {
    if (disconnectCursor.isPending) return;
    const confirmed = await confirmDialog({
      title: 'Отключить Cursor?',
      body: 'Убрать подключение Cursor из Rox? Копия ключа API в Rox удалится, но в самом Cursor ключ не отзовётся.',
      confirmLabel: 'Отключить',
      tone: 'danger',
    });
    if (!confirmed || disconnectCursor.isPending) return;
    try {
      await disconnectCursor.mutateAsync();
      setCursorApiKey('');
      toast.success('Cursor отключён');
    } catch (error) {
      toast.failure(failureMessage(error, 'Не удалось отключить Cursor'));
    }
  };

  return (
    <>
      <Show when={!pairingDialog()}>
        <SettingsSearchTarget result={highlight()}>
          <SettingsPage
            title="Машины"
            description="Поставщики и машины, на которых могут работать агенты."
            signpost={<TutorialPill tutorial="roxd" class="mt-1 self-start" />}
            onBack={props.onBack}
            backLabel={props.backLabel ?? 'Агенты'}
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPairingDialog({})}
              >
                <PlusIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
                Новая машина
              </Button>
            }
          >
            <GetComputerEntry onGet={() => setBuyingComputer(true)} />
            <PendingRequestsSection />
            <ConnectedRuntimesSection
              harnesses={
                harnessesQuery.isSuccess
                  ? harnessesQuery.data.filter(
                      // A Rox computer is listed once, under Rox computers;
                      // with that section off it stays an ordinary machine.
                      // An agent teammate's computer is never one: people
                      // message the agent instead.
                      (harness) =>
                        harness.access === 'owner' &&
                        !isTeamAgentComputer(harness) &&
                        !(
                          teamComputers.enabled() &&
                          (harness.computer_id ||
                            computerHarnessIds().has(harness.id))
                        )
                    )
                  : []
              }
              error={harnessesQuery.isError}
              onRename={setRenamingHarness}
              onRemove={setRemovingHarness}
              sharing={sharing()}
              onSharingChange={setSharing}
            />
            <TeammateRuntimesSection
              canRemoveShared={isTeamOwner()}
              onRemove={setRemovingHarness}
            />
            <MacroComputers
              harnesses={harnesses()}
              buying={buyingComputer()}
              onBuyingChange={setBuyingComputer}
            />
            <LocalRuntimeCard />
            <div>
              <h2 class="mb-3 px-6 text-sm font-semibold text-ink">
                Встроенные машины
              </h2>
              <SettingsCard inset="wide">
                <MachineSection>
                  <HarnessIcon>
                    <HardDrivesIcon />
                  </HarnessIcon>
                  <div class="min-w-0 flex-1">
                    <div class="flex min-h-5 items-start justify-between gap-3">
                      <h2 class="min-w-0 text-sm/5 font-medium text-ink">
                        {MACRO_HARNESS_NAME}
                      </h2>
                      <span class="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md bg-success-bg px-2 text-[11px]/none font-medium text-success">
                        Встроено
                      </span>
                    </div>
                    <p class="mt-1 text-sm text-ink-muted">
                      Собственный быстрый и мощный агент Rox. Пользуется
                      официальными инструментами Rox и MCP.
                    </p>
                  </div>
                </MachineSection>

                <MachineSection>
                  <HarnessIcon>
                    <CursorIcon />
                  </HarnessIcon>
                  <div class="min-w-0 flex-1">
                    <div class="flex min-h-5 items-start justify-between gap-3">
                      <h2 class="min-w-0 text-sm/5 font-medium text-ink">
                        Cursor
                      </h2>
                      <Show when={cursorRegistered()}>
                        <span class="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md bg-success-bg px-2 text-[11px]/none font-medium text-success">
                          Подключено
                        </span>
                      </Show>
                    </div>
                    <p class="mt-1 text-sm text-ink-muted">
                      Подключите свою подписку Cursor к Rox. Сессии Cursor
                      Cloud можно вести прямо в приложении.
                    </p>

                    <Show
                      when={
                        cursorStatus.isSuccess &&
                        !cursorStatus.isPlaceholderData
                      }
                      fallback={
                        <p class="mt-4 text-xs text-ink-muted">
                          {cursorStatus.isError
                            ? 'Не удалось загрузить подключение Cursor. Обновите страницу.'
                            : 'Загрузка…'}
                        </p>
                      }
                    >
                      <Show
                        when={cursorRegistered()}
                        fallback={
                          <div class="mt-4 flex flex-col gap-1.5">
                            <label
                              for="cursor-harness-api-key"
                              class="text-xs text-ink"
                            >
                              Ключ API
                            </label>
                            <div class="flex items-center gap-2 mobile:flex-col mobile:items-stretch">
                              <ApiKeyInput
                                id="cursor-harness-api-key"
                                class="flex-1"
                                size="sm"
                                prefix={CURSOR_KEY_PREFIX}
                                value={cursorApiKey()}
                                onValueChange={setCursorApiKey}
                                onSubmit={() =>
                                  fireAndForget(
                                    handleSaveCursorApiKey(),
                                    'cursor-connect'
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={
                                  cursorApiKey().trim().length === 0 ||
                                  saveCursorApiKey.isPending
                                }
                                onClick={handleSaveCursorApiKey}
                              >
                                Сохранить
                              </Button>
                            </div>
                            <p class="text-xs text-ink-extra-muted">
                              Создайте ключ API в Cursor и вставьте его сюда. Rox
                              хранит его в зашифрованном виде.
                            </p>
                          </div>
                        }
                      >
                        <div class="mt-4 flex flex-col gap-3">
                          <div class="flex w-full max-w-60 flex-col gap-1.5">
                            <span class="text-xs font-medium text-ink">
                              Модель по умолчанию
                            </span>
                            <CursorDefaultModel />
                          </div>
                          <p class="text-xs text-ink-extra-muted">
                            Модель, с которой начинаются новые сессии `@cursor`.
                            Рекомендуемые — сверху, остальные скрыты за пунктом
                            «Ещё модели».
                          </p>
                        </div>

                        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p class="flex-1 basis-56 text-xs text-ink-extra-muted">
                            Отключение удаляет копию ключа в Rox, но не отзывает
                            его в Cursor.
                          </p>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            class="shrink-0"
                            disabled={disconnectCursor.isPending}
                            onClick={handleDisconnectCursor}
                          >
                            Отключить
                          </Button>
                        </div>
                      </Show>
                    </Show>
                  </div>
                </MachineSection>

                <Show when={canUseCodex()}>
                  <CodexHarness />
                </Show>
              </SettingsCard>
            </div>
          </SettingsPage>
        </SettingsSearchTarget>
      </Show>

      <Show when={pairingDialog()} keyed>
        {(dialog) => (
          <RuntimePairingPage
            initialCode={dialog.initialCode}
            onClose={closePairing}
          />
        )}
      </Show>
      <Show when={renamingHarness()} keyed>
        {(harness) => (
          <HarnessRenameDialog
            harness={harness}
            onClose={() => setRenamingHarness(undefined)}
          />
        )}
      </Show>
      <Show when={removingHarness()} keyed>
        {(harness) => (
          <HarnessRemoveDialog
            harnessName={harness.name}
            pending={removing() || deleteHarnessMutation.isPending}
            onClose={() => setRemovingHarness(undefined)}
            onConfirm={() => fireAndForget(removeHarness(), 'harness-settings')}
          />
        )}
      </Show>
    </>
  );
}

function HarnessRenameDialog(props: {
  harness: RegisteredHarness;
  onClose: () => void;
}) {
  const patchHarness = usePatchHarnessMutation();
  const [name, setName] = createSignal(props.harness.name);
  const canSave = () =>
    !patchHarness.isPending &&
    name().trim().length > 0 &&
    name().trim() !== props.harness.name;

  const save = async () => {
    if (!canSave()) return;
    try {
      await patchHarness.mutateAsync({
        harnessId: props.harness.id,
        name: name().trim(),
      });
      props.onClose();
    } catch (error) {
      toast.failure(failureMessage(error, 'Не удалось переименовать машину'));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) =>
        !open && !patchHarness.isPending && props.onClose()
      }
      position="center"
      visibleScrim
      class="w-[min(480px,calc(100vw-16px))]"
    >
      <Panel depth={2} class="rounded-xl text-ink">
        <Panel.Header class="px-5 py-3">
          <Dialog.Title class="text-sm font-semibold">
            Переименовать машину
          </Dialog.Title>
        </Panel.Header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            fireAndForget(save(), 'harness-settings');
          }}
        >
          <Panel.Body class="flex flex-col gap-1.5 p-5">
            <label for="harness-rename" class="text-xs font-medium text-ink">
              Название
            </label>
            <Input
              id="harness-rename"
              size="sm"
              autofocus
              maxLength={100}
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </Panel.Body>
          <Panel.Footer class="justify-end gap-2 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={patchHarness.isPending}
              onClick={props.onClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!canSave()}
            >
              {patchHarness.isPending ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </Panel.Footer>
        </form>
      </Panel>
    </Dialog>
  );
}

function HarnessRemoveDialog(props: {
  harnessName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !props.pending && props.onClose()}
      position="center"
      visibleScrim
      class="w-[min(480px,calc(100vw-16px))]"
    >
      <Panel depth={2} class="rounded-xl text-ink">
        <Panel.Header class="px-5 py-3">
          <Dialog.Title class="text-sm font-semibold">
            Удалить {props.harnessName}?
          </Dialog.Title>
        </Panel.Header>
        <Panel.Body class="p-5">
          <Dialog.Description class="text-sm leading-5 text-ink-muted">
            Агенты на этой машине остановятся, пока её снова не подключат.
            roxd на ней нужно будет сопрячь заново.
          </Dialog.Description>
        </Panel.Body>
        <Panel.Footer class="justify-end gap-2 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={props.pending}
            onClick={props.onClose}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={props.pending}
            onClick={props.onConfirm}
          >
            {props.pending ? 'Удаление…' : 'Удалить машину'}
          </Button>
        </Panel.Footer>
      </Panel>
    </Dialog>
  );
}
