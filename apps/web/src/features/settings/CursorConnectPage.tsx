import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { ThrownResultError } from '@core/util/result';
import ArrowLeftIcon from '@icon/system/regular/arrow-left.svg';
import {
  useCursorApiKeyStatusQuery,
  useDisconnectCursorApiKey,
  useSaveCursorApiKey,
} from '@queries/auth/cursor-api-key';
import { ApiKeyInput, Button, confirmDialog } from '@ui';
import { createSignal, Show } from 'solid-js';
import cursorApiKeysScreenshot from './assets/cursor-api-keys.png';
import { CursorDefaultModel } from './components/cursor-default-model';
import {
  SetupField,
  SetupLink,
  SetupStep,
} from './components/runtime-setup-steps';
import {
  CURSOR_KEY_FORMAT_ERROR,
  CURSOR_KEY_PREFIX,
  isCursorApiKey,
} from './core/cursor-api-key';
import { SettingsPage, SettingsSurface } from './primitives';

const CURSOR_API_KEYS_URL = 'https://cursor.com/dashboard/api';

function failureMessage(error: unknown, fallback: string): string {
  return (error instanceof ThrownResultError && error.message) || fallback;
}

/**
 * Guided Cursor connection: where to create the key, a field to paste it, and
 * the default model once Cursor answers. Also the manage page once connected.
 */
export function CursorConnectPage(props: { onClose: () => void }) {
  const status = useCursorApiKeyStatusQuery();
  const saveKey = useSaveCursorApiKey();
  const disconnect = useDisconnectCursorApiKey();
  const [apiKey, setApiKey] = createSignal('');
  const loaded = () => status.isSuccess && !status.isPlaceholderData;
  const connected = () =>
    status.isSuccess && !status.isPlaceholderData
      ? status.data.registered
      : false;
  // The field mounts once status loads; focus it then, without scrolling the
  // guide's first step out of view.
  const focusOnMount = (input: HTMLInputElement) =>
    queueMicrotask(() => input.focus({ preventScroll: true }));

  const connect = async () => {
    const key = apiKey().trim();
    if (!key || saveKey.isPending) return;
    if (!isCursorApiKey(key)) {
      toast.failure(CURSOR_KEY_FORMAT_ERROR);
      return;
    }
    try {
      await saveKey.mutateAsync(key);
      setApiKey('');
      toast.success('Cursor подключён');
    } catch (error) {
      toast.failure(
        failureMessage(error, 'Не удалось сохранить ключ API Cursor')
      );
    }
  };

  const disconnectCursor = async () => {
    if (disconnect.isPending) return;
    const confirmed = await confirmDialog({
      title: 'Отключить Cursor?',
      body: 'Убрать подключение Cursor из Rox? Копия ключа API в Rox будет удалена, но в Cursor ключ не отзовётся.',
      confirmLabel: 'Отключить',
      tone: 'danger',
    });
    if (!confirmed || disconnect.isPending) return;
    try {
      await disconnect.mutateAsync();
      toast.success('Cursor отключён');
    } catch (error) {
      toast.failure(failureMessage(error, 'Не удалось отключить Cursor'));
    }
  };

  return (
    <SettingsPage
      title={connected() ? 'Cursor' : 'Подключить Cursor'}
      showTitleInSheet
      description="Запускайте агентов на своей подписке Cursor. Сессии идут в Cursor Cloud и появляются в Rox."
      actions={
        <Button variant="ghost" size="sm" onClick={props.onClose}>
          <ArrowLeftIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
          Назад
        </Button>
      }
    >
      <section aria-label="Подключить Cursor">
        <SettingsSurface class="@container p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              fireAndForget(connect(), 'cursor-connect');
            }}
          >
            <ol aria-label="Шаги настройки Cursor" class="list-none">
              <SetupStep number={1} title="Создайте ключ API в Cursor">
                <p>
                  В панели Cursor откройте{' '}
                  <span class="font-medium text-ink">API &amp; SSH Keys</span> и
                  нажмите <span class="font-medium text-ink">New API Key</span>.
                </p>
                <img
                  src={cursorApiKeysScreenshot}
                  alt="Панель Cursor: выбран раздел API & SSH Keys и кнопка New API Key"
                  width={1200}
                  height={145}
                  class="block h-auto w-full rounded-[10px] border border-ink/10"
                />
                <SetupLink href={CURSOR_API_KEYS_URL}>
                  Открыть API &amp; SSH Keys
                </SetupLink>
              </SetupStep>
              <SetupStep number={2} title="Вставьте ключ API">
                <p>
                  Rox хранит его в зашифрованном виде и использует только чтобы
                  запускать ваши сессии Cursor и следить за ними.
                </p>
                <Show
                  when={loaded()}
                  fallback={
                    <p class="text-xs">
                      {status.isError
                        ? 'Не удалось загрузить подключение Cursor. Обновите страницу.'
                        : 'Загрузка…'}
                    </p>
                  }
                >
                  <Show
                    when={connected()}
                    fallback={
                      <div class="flex flex-col gap-1.5">
                        <label
                          for="cursor-api-key"
                          class="text-xs font-medium text-ink"
                        >
                          Ключ API
                        </label>
                        <ApiKeyInput
                          ref={focusOnMount}
                          id="cursor-api-key"
                          aria-describedby="cursor-api-key-help"
                          size="lg"
                          prefix={CURSOR_KEY_PREFIX}
                          value={apiKey()}
                          disabled={saveKey.isPending}
                          onValueChange={setApiKey}
                        />
                        <p
                          id="cursor-api-key-help"
                          class="text-xs text-ink-extra-muted"
                        >
                          Ключ можно удалить на этой странице в любой момент.
                        </p>
                      </div>
                    }
                  >
                    <div class="flex flex-wrap items-center gap-3">
                      <span class="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md bg-success-bg px-2 text-[11px]/none font-medium text-success">
                        Подключено
                      </span>
                      <Show when={status.data?.updatedAt}>
                        {(updatedAt) => (
                          <span class="text-xs text-ink-muted">
                            Ключ сохранён{' '}
                            {new Date(updatedAt()).toLocaleDateString()}
                          </span>
                        )}
                      </Show>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="ml-auto text-negative"
                        disabled={disconnect.isPending}
                        onClick={() =>
                          fireAndForget(disconnectCursor(), 'cursor-connect')
                        }
                      >
                        Отключить
                      </Button>
                    </div>
                  </Show>
                </Show>
              </SetupStep>
              <SetupStep number={3} title="Выберите модель по умолчанию">
                <p>
                  Новые агенты Cursor начинают с этой модели. Для каждого агента
                  её можно сменить.
                </p>
                <div class="flex flex-col gap-1.5">
                  <span class="text-xs font-medium text-ink">
                    Модель по умолчанию
                  </span>
                  <Show
                    when={connected()}
                    fallback={
                      <SetupField class="text-sm text-ink-muted">
                        <span aria-disabled="true">
                          Доступно после подключения Cursor
                        </span>
                      </SetupField>
                    }
                  >
                    <CursorDefaultModel triggerClass="flex w-full items-center justify-between gap-2 rounded-lg border border-edge-muted bg-ink/[0.025] px-3 py-2 text-left text-sm text-ink outline-none transition-colors hover:border-ink/20 focus-visible:border-accent data-expanded:border-accent" />
                  </Show>
                  <p class="text-xs text-ink-extra-muted">
                    Используется, если агент не выбирает свою.
                  </p>
                </div>
              </SetupStep>
            </ol>
            <div class="mt-6 flex justify-end gap-2 border-t border-edge-muted pt-4">
              <Show
                when={connected()}
                fallback={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={props.onClose}
                    >
                      Отмена
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={!apiKey().trim() || saveKey.isPending}
                    >
                      {saveKey.isPending ? 'Подключение…' : 'Подключить Cursor'}
                    </Button>
                  </>
                }
              >
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={props.onClose}
                >
                  Готово
                </Button>
              </Show>
            </div>
          </form>
        </SettingsSurface>
      </section>
    </SettingsPage>
  );
}
