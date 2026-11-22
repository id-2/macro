import { toast } from '@core/component/Toast/Toast';
import { SERVER_HOSTS } from '@core/constant/servers';
import {
  isAllowedHandle,
  mailboxAddress,
  ROX_MAIL_DOMAIN,
} from '@core/email/rox-mailbox';
import { useEmailLinks } from '@core/email-link';
import { fireAndForget } from '@core/util/fireAndForget';
import { platformFetch } from '@core/util/platformFetch';
import CheckIcon from '@icon/system/regular/check.svg';
import { isRealNamePart, useOwnUserName } from '@queries/auth/user-name-self';
import { Button, Dialog, Panel } from '@ui';
import { createEffect, createSignal, Match, Show, Switch } from 'solid-js';

/**
 * Claims a mailbox name through the auth handle route. The caller then opens
 * the Rox link. Does not call the mail host.
 */
async function claimMailboxName(handle: string): Promise<void> {
  const response = await platformFetch(
    `${SERVER_HOSTS['auth-service']}/user/handle`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ handle }),
    }
  );
  if (!response.ok) throw new Error(await claimFailure(response));
  let body: { address?: unknown };
  try {
    body = (await response.json()) as { address?: unknown };
  } catch {
    throw new Error('Сервер ответил не адресом, а другим форматом.');
  }
  if (typeof body.address !== 'string' || body.address.length === 0) {
    throw new Error('Сервер не вернул адрес почты.');
  }
}

async function claimFailure(response: Response): Promise<string> {
  const message = await readErrorMessage(response);
  if (response.status === 409) {
    if (message.includes('already claimed a different')) {
      return 'Для этого аккаунта имя уже выбрано.';
    }
    if (message.includes('already taken')) return 'Это имя уже занято.';
    return 'Это имя уже занято, или для этого аккаунта имя уже выбрано.';
  }
  if (response.status === 400) {
    if (message.includes('invalid account identity')) {
      return 'Аккаунт не распознан. Войдите снова.';
    }
    if (message.includes('invalid or reserved')) {
      return 'Имя недопустимо или зарезервировано.';
    }
    return message
      ? `Имя отклонено: ${message}`
      : 'Имя отклонено: сервер счёл его недопустимым.';
  }
  if (response.status === 401) {
    return 'Сессия не подтверждена. Войдите снова и повторите.';
  }
  if (response.status === 500) {
    return message && message !== 'unable to claim handle'
      ? `Сервер не сохранил имя: ${message}`
      : 'Сервер не смог сохранить имя. Попробуйте ещё раз.';
  }
  return message
    ? `Сервер ответил ${response.status}: ${message}`
    : `Сервер ответил ошибкой ${response.status}.`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { message?: unknown };
    if (typeof parsed.message === 'string') return parsed.message.trim();
  } catch {
    // A proxy can answer with plain text. Keep a short piece of it.
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function localPart(value: string): string {
  let next = value.trim().toLowerCase();
  const suffix = `@${ROX_MAIL_DOMAIN}`;
  if (next.endsWith(suffix)) next = next.slice(0, -suffix.length);
  return next;
}

/** Why a typed name cannot be used. Empty and allowed names have no reason. */
function handleReason(value: string): string | undefined {
  if (value.length === 0 || isAllowedHandle(value)) return undefined;
  if (value.length < 3) return 'Не короче 3 символов';
  if (value.length > 32) return 'Не длиннее 32 символов';
  if (!/^[a-z0-9._-]+$/.test(value)) {
    return 'Только строчные буквы, цифры, точка, _ и -';
  }
  if (value.startsWith('.') || value.endsWith('.')) {
    return 'Точка не может быть в начале или в конце';
  }
  if (value.includes('..')) return 'Точки не могут стоять подряд';
  return 'Это имя зарезервировано';
}

function mailboxOpenFailure(tag: string): string {
  switch (tag) {
    case 'PaymentRequired':
      return 'Имя сохранено, но почта не открылась: нужна оплата.';
    case 'SharedInboxConflict':
      return 'Имя сохранено, но этот ящик уже подключён у другого человека.';
    case 'NoGmailGrant':
      return 'Имя сохранено, но нет разрешения открыть почту.';
    case 'FailedToInitialize':
      return 'Имя сохранено, но почтовый ящик не открылся.';
    default:
      return `Имя сохранено, но почта не открылась (${tag}).`;
  }
}

const inputClass =
  'min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none disabled:opacity-50';

export function CreateRoxMailboxDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { initEmailLink } = useEmailLinks();
  const ownName = useOwnUserName();
  const [step, setStep] = createSignal<1 | 2 | 3>(1);
  const [handle, setHandle] = createSignal('');
  const [firstName, setFirstName] = createSignal('');
  const [lastName, setLastName] = createSignal('');
  const [namesSeeded, setNamesSeeded] = createSignal(false);
  const [claiming, setClaiming] = createSignal(false);
  const [claimedHandle, setClaimedHandle] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  let wasOpen = false;

  createEffect(() => {
    const open = props.open;
    if (open && !wasOpen) {
      setStep(1);
      setError(undefined);
    }
    wasOpen = open;
  });

  createEffect(() => {
    if (namesSeeded()) return;
    const name = ownName();
    if (!name) return;
    setNamesSeeded(true);
    if (!firstName() && isRealNamePart(name.first_name)) {
      setFirstName(name.first_name ?? '');
    }
    if (!lastName() && isRealNamePart(name.last_name)) {
      setLastName(name.last_name ?? '');
    }
  });

  const finish = () => {
    toast.success('Почта Rox создана.');
    props.onOpenChange(false);
  };

  const create = async () => {
    const name = handle();
    if (claiming() || !isAllowedHandle(name)) return;
    setClaiming(true);
    setError(undefined);
    try {
      if (claimedHandle() !== name) {
        await claimMailboxName(name);
        setClaimedHandle(name);
      }
      const opened = await initEmailLink();
      if (opened.isErr()) {
        if (opened.error.tag === 'AlreadyInitialized') {
          finish();
          return;
        }
        setError(mailboxOpenFailure(opened.error.tag));
        return;
      }
      finish();
    } catch (cause) {
      if (cause instanceof TypeError) {
        setError('Не удалось связаться с сервером.');
        return;
      }
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Создание прервалось без текста ошибки.'
      );
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      position="center"
      animate
      class="w-96 max-w-[calc(100vw-2rem)]"
      onOpenChange={(next) => {
        if (next || claiming()) return;
        props.onOpenChange(false);
      }}
    >
      <Panel>
        <Panel.Body>
          <form
            class="flex flex-col gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (step() === 1 && isAllowedHandle(handle())) setStep(2);
              else if (
                step() === 2 &&
                firstName().trim().length > 0 &&
                lastName().trim().length > 0
              )
                setStep(3);
              else if (step() === 3) fireAndForget(create(), 'rox-mailbox');
            }}
          >
            <div>
              <Dialog.Title class="text-base font-semibold">
                Создать почту Rox
              </Dialog.Title>
              <Dialog.Description class="mt-1 text-sm text-ink-muted">
                Шаг {step()} из 3
              </Dialog.Description>
            </div>

            <Switch>
              <Match when={step() === 1}>
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Имя адреса
                  <span class="flex min-w-0 items-center rounded-lg border border-edge-muted bg-input focus-within:border-accent">
                    <input
                      class={inputClass}
                      type="text"
                      name="handle"
                      autocomplete="username"
                      autocapitalize="none"
                      autocorrect="off"
                      spellcheck={false}
                      autofocus
                      aria-label="Имя адреса"
                      aria-invalid={handle().length > 0 && !isAllowedHandle(handle())}
                      value={handle()}
                      disabled={claiming()}
                      onInput={(event) => {
                        const next = localPart(event.currentTarget.value);
                        setHandle(next);
                        setError(undefined);
                        if (event.currentTarget.value !== next) {
                          event.currentTarget.value = next;
                        }
                      }}
                    />
                    <span class="shrink-0 pr-3 text-sm font-normal text-ink-muted">
                      @{ROX_MAIL_DOMAIN}
                    </span>
                  </span>
                </label>
                <Show
                  when={isAllowedHandle(handle())}
                  fallback={
                    <Show when={handleReason(handle())}>
                      <p role="alert" class="text-sm text-failure-ink">
                        {handleReason(handle())}
                      </p>
                    </Show>
                  }
                >
                  <p class="flex items-center gap-1.5 text-sm text-success">
                    <CheckIcon class="size-4" aria-hidden="true" />
                    <span>Имя подходит</span>
                  </p>
                </Show>
              </Match>
              <Match when={step() === 2}>
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Имя
                  <input
                    class="rounded-lg border border-edge-muted bg-input px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent"
                    type="text"
                    name="given-name"
                    autocomplete="given-name"
                    autofocus
                    aria-label="Имя"
                    value={firstName()}
                    disabled={claiming()}
                    onInput={(event) =>
                      setFirstName(event.currentTarget.value)
                    }
                  />
                </label>
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Фамилия
                  <input
                    class="rounded-lg border border-edge-muted bg-input px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent"
                    type="text"
                    name="family-name"
                    autocomplete="family-name"
                    aria-label="Фамилия"
                    value={lastName()}
                    disabled={claiming()}
                    onInput={(event) => setLastName(event.currentTarget.value)}
                  />
                </label>
              </Match>
              <Match when={step() === 3}>
                <dl class="flex flex-col gap-3 text-sm">
                  <div>
                    <dt class="text-ink-muted">Адрес</dt>
                    <dd class="ph-no-capture font-medium text-ink">
                      {mailboxAddress(handle())}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Имя</dt>
                    <dd class="ph-no-capture font-medium text-ink">
                      {`${firstName().trim()} ${lastName().trim()}`.trim()}
                    </dd>
                  </div>
                </dl>
              </Match>
            </Switch>

            <Show when={error()}>
              <p role="alert" class="text-sm text-failure-ink">
                {error()}
              </p>
            </Show>

            <div class="flex justify-end gap-2">
              <Show when={step() > 1}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={claiming()}
                  onClick={() => {
                    setError(undefined);
                    setStep((current) => (current === 3 ? 2 : 1));
                  }}
                >
                  Назад
                </Button>
              </Show>
              <Show
                when={step() < 3}
                fallback={
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={claiming() || !isAllowedHandle(handle())}
                  >
                    {claiming() ? 'Создаём…' : 'Создать'}
                  </Button>
                }
              >
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    step() === 1
                      ? !isAllowedHandle(handle())
                      : firstName().trim().length === 0 ||
                        lastName().trim().length === 0
                  }
                >
                  Далее
                </Button>
              </Show>
            </div>
          </form>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}
