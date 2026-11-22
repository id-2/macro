import { LocalRuntimeSetup } from '@app/features/local-runtime/local-runtime-setup';
import { localRuntimeDeployment } from '@app/features/local-runtime/queries/setup-capabilities';
import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { isDesktopPlatform } from '@core/util/platform';
import LaptopIcon from '@icon/system/regular/laptop.svg';
import SpinnerIcon from '@icon/system/regular/spinner-gap.svg';
import {
  type RoxdStatus as RoxdSnapshot,
  type RoxdSupport,
  roxdInspect,
  roxdStart,
  roxdStatus,
  roxdStop,
  roxdSupport,
  onRoxdStatus,
} from '@rox/tauri/roxd';
import { useAgentsQuery } from '@queries/agents/agents';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { Button } from '@ui';
import {
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import { HarnessIcon, StatusDot } from '../integration-ui';
import { SettingsCard } from '../primitives';
import { MachineSection } from './connected-runtimes-section';

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.length > 0) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * One-click local runtime on the desktop app: the bundled roxd daemon is
 * configured, paired, and supervised without the user touching a terminal.
 * Setup runs through the shared `LocalRuntimeSetupPanel`, which also creates
 * an agent on the runtime; the app-wide `RoxdPairingApprover` approves the
 * daemon's pairing code, so no code is ever typed.
 */
export function LocalRuntimeCard() {
  // Everything here talks to the Tauri main process; on other platforms the
  // card renders nothing and calls nothing.
  if (!isDesktopPlatform()) return null;

  const agentsQuery = useAgentsQuery();
  const [support, setSupport] = createSignal<RoxdSupport>();
  const [snapshot, setSnapshot] = createSignal<RoxdSnapshot>();
  /** Whether a config already exists on disk (daemon may be stopped). */
  const [configured, setConfigured] = createSignal(false);
  /** The setup panel, and the running daemon it finishes when set. */
  const [setup, setSetup] = createSignal<{ running?: RoxdSnapshot }>();
  const [busy, setBusy] = createSignal(false);

  const handleStatus = (next: RoxdSnapshot) => {
    setSnapshot(next);
    if (next.phase === 'running') setConfigured(true);
  };

  onMount(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const probe = async () => {
      try {
        const [supportInfo, current] = await Promise.all([
          roxdSupport(),
          roxdStatus(),
        ]);
        if (disposed) return;
        setSupport(supportInfo);
        handleStatus(current);
        if (!supportInfo.supported) return;
        unlisten = await onRoxdStatus(handleStatus);
        if (disposed) {
          fireAndForget(unlisten(), 'local-runtime-card');
          return;
        }
        const inspection = await roxdInspect();
        if (!disposed && inspection.exists) setConfigured(true);
      } catch (error) {
        console.error('could not probe the bundled roxd daemon', error);
      }
    };
    fireAndForget(probe(), 'local-runtime-card');
    onCleanup(() => {
      disposed = true;
      const dispose = unlisten;
      if (dispose) fireAndForget(dispose(), 'local-runtime-card');
    });
  });

  /** The agent bound to the running daemon, once the agents list answers. */
  const boundAgent = () => {
    const harnessId = snapshot()?.harnessId;
    if (!harnessId || !agentsQuery.isSuccess) return undefined;
    return agentsQuery.data.find((agent) => agent.harness_id === harnessId);
  };

  const startExisting = async () => {
    if (busy()) return;
    setBusy(true);
    try {
      await roxdStart({ ...localRuntimeDeployment() });
    } catch (error) {
      toast.failure(errorMessage(error, 'Не удалось запустить этот компьютер'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (busy()) return;
    setBusy(true);
    try {
      await roxdStop();
    } catch (error) {
      toast.failure(errorMessage(error, 'Не удалось остановить этот компьютер'));
    } finally {
      setBusy(false);
    }
  };

  const phase = () => snapshot()?.phase ?? 'stopped';
  const working = () =>
    phase() === 'starting' ||
    phase() === 'installing-adapter' ||
    phase() === 'pairing';

  return (
    <Show when={support()?.supported}>
      <div>
        <h2 class="mb-3 px-6 text-sm font-semibold text-ink">
          Этот компьютер
        </h2>
        <SettingsCard inset="wide">
          <MachineSection>
            <HarnessIcon>
              <LaptopIcon />
            </HarnessIcon>
            <div class="min-w-0 flex-1">
              <div class="flex min-h-5 items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-2">
                  <h2 class="min-w-0 text-sm/5 font-medium text-ink">
                    Запустить агентов на этом компьютере
                  </h2>
                  <StatusDot
                    state={
                      phase() === 'running'
                        ? 'connected'
                        : phase() === 'error'
                          ? 'attention'
                          : 'disconnected'
                    }
                    label={
                      phase() === 'running'
                        ? 'Работает'
                        : phase() === 'error'
                          ? 'Ошибка'
                          : 'Не запущено'
                    }
                  />
                </div>
                <Show when={phase() === 'running' && !setup()}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy()}
                    onClick={() => fireAndForget(stop(), 'local-runtime-card')}
                  >
                    Остановить
                  </Button>
                </Show>
              </div>
              <p class="mt-1 text-sm text-ink-muted">
                Rox запускает агентов, которые уже установлены у вас: Claude
                Code, Codex и другие — прямо здесь, с вашими подписками и
                локальными файлами.
              </p>

              <Switch>
                <Match when={setup()}>
                  {(open) => (
                    <div class="mt-4">
                      <LocalRuntimeSetup
                        defaultWorkspace={
                          support()?.defaultWorkspace ?? undefined
                        }
                        running={open().running}
                        onClose={() => setSetup(undefined)}
                      />
                    </div>
                  )}
                </Match>

                <Match when={working()}>
                  <div class="mt-4 flex items-center gap-2 text-sm text-ink-muted">
                    <SpinnerIcon class="size-4 animate-spin" />
                    <Switch>
                      <Match when={phase() === 'installing-adapter'}>
                        Устанавливаем адаптер агента…
                      </Match>
                      <Match when={phase() === 'pairing'}>
                        Подключаем этот компьютер к вашей учётной записи…
                      </Match>
                      <Match when>Запускаем…</Match>
                    </Switch>
                  </div>
                </Match>

                <Match when={phase() === 'running'}>
                  <Show
                    when={boundAgent()}
                    fallback={
                      <div class="mt-4 flex flex-wrap items-center gap-3">
                        <p class="text-sm text-ink-muted">
                          <span class="font-medium text-ink">
                            {snapshot()?.agentName ?? 'Ваш агент'}
                          </span>{' '}
                          подключён, но агент Rox на нём ещё не создан.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setSetup({ running: snapshot() })}
                        >
                          Создать агента
                        </Button>
                      </div>
                    }
                  >
                    {(agent) => (
                      <>
                        <p class="mt-4 text-sm text-ink-muted">
                          <span class="font-medium text-ink">
                            @{agent().bot.handle}
                          </span>{' '}
                          готов. Пока вы им пользуетесь, держите Rox открытым.
                        </p>
                        <Show when={snapshot()?.workspace}>
                          {(dir) => (
                            <p class="mt-1 text-xs text-ink-extra-muted">
                              Сеансы выполняются в{' '}
                              <span class="font-mono text-xs">{dir()}</span>.
                            </p>
                          )}
                        </Show>
                      </>
                    )}
                  </Show>
                </Match>

                <Match when={phase() === 'error'}>
                  <div class="mt-4 flex flex-wrap items-center gap-3">
                    <p class="text-sm text-failure">
                      {snapshot()?.lastError ??
                        'Этот компьютер перестал запускать агентов.'}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy()}
                      onClick={() =>
                        configured()
                          ? fireAndForget(startExisting(), 'local-runtime-card')
                          : setSetup({})
                      }
                    >
                      Повторить
                    </Button>
                  </div>
                </Match>

                <Match when={configured()}>
                  <div class="mt-4 flex flex-wrap items-center gap-3">
                    <p class="text-sm text-ink-muted">
                      Компьютер настроен, но сейчас не работает.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy()}
                      onClick={() =>
                        fireAndForget(startExisting(), 'local-runtime-card')
                      }
                    >
                      {busy() ? 'Запускаем…' : 'Запустить'}
                    </Button>
                  </div>
                </Match>

                <Match when>
                  <div class="mt-4">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setSetup({})}
                    >
                      Настроить
                    </Button>
                  </div>
                </Match>
              </Switch>
            </div>
          </MachineSection>
        </SettingsCard>
      </div>
    </Show>
  );
}
