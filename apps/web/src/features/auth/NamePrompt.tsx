import { toast } from '@core/component/Toast/Toast';
import { useUserId } from '@core/context/user';
import { fireAndForget } from '@core/util/fireAndForget';
import {
  invalidateOwnUserName,
  isRealNamePart,
  useOwnUserName,
} from '@queries/auth/user-name-self';
import { authServiceClient } from '@service-auth/client';
import { ActionDialogShell, Button, Dialog, TextField } from '@ui';
import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js';

const NAME_MAX = 80;
const PROMPT_DELAY_MS = 800;

function dismissedBefore(userId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(`name-prompt-dismissed:${userId}`) === '1';
  } catch {
    return false;
  }
}

/**
 * Asks a person who signed in without giving a name (passwordless, SSO) what
 * to call them, because the sidebar, mentions and settings all show the email
 * until a first name exists. Closing is remembered per account, so the
 * question is asked once and the name stays reachable in Account settings.
 */
export function NamePrompt() {
  const userId = useUserId();
  const userName = useOwnUserName();
  const [dismissed, setDismissed] = createSignal(false);
  const [ready, setReady] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [firstName, setFirstName] = createSignal('');
  const [lastName, setLastName] = createSignal('');
  const [error, setError] = createSignal<string>();

  const missingName = createMemo(() => {
    const name = userName();
    return name ? !isRealNamePart(name.first_name) : false;
  });

  // A short pause keeps the question from landing on top of the first paint.
  createEffect(() => {
    if (!missingName() || ready()) return;
    const timer = setTimeout(() => setReady(true), PROMPT_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  function close() {
    try {
      localStorage.setItem(`name-prompt-dismissed:${userId()}`, '1');
    } catch {
      // Storage may be unavailable or full. The in-memory dismissal still applies.
    }
    setDismissed(true);
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const first = firstName().trim();
    if (!first || saving()) return;
    setSaving(true);
    setError(undefined);
    const last = lastName().trim();
    const result = await authServiceClient.putUserName({
      first_name: first,
      ...(last ? { last_name: last } : {}),
    });
    setSaving(false);
    if (result.isErr()) {
      setError('Не удалось сохранить имя. Попробуйте ещё раз.');
      return;
    }
    fireAndForget(invalidateOwnUserName(), 'name-prompt');
    setDismissed(true);
    toast.success('Спасибо! Теперь коллеги увидят ваше имя.');
  }

  return (
    <Show
      when={
        ready() && missingName() && !dismissed() && !dismissedBefore(userId())
      }
    >
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next && !saving()) close();
        }}
        position="center"
        class="w-110"
      >
        <form onSubmit={save}>
          <ActionDialogShell>
            <ActionDialogShell.Body>
              <ActionDialogShell.Header>
                <ActionDialogShell.Title>
                  Как к вам обращаться?
                </ActionDialogShell.Title>
                <ActionDialogShell.Description>
                  Имя показывается коллегам в Rox вместо адреса почты. Фамилию
                  можно указать сразу или позже в настройках.
                </ActionDialogShell.Description>
              </ActionDialogShell.Header>
              <TextField
                value={firstName()}
                onChange={(value) => {
                  setFirstName(value);
                  setError(undefined);
                }}
                validationState={error() ? 'invalid' : 'valid'}
                required
              >
                <TextField.Label>Имя</TextField.Label>
                <TextField.Input
                  autofocus
                  maxLength={NAME_MAX}
                  placeholder="Например, Анна"
                />
                <TextField.ErrorMessage
                  errors={error() ? [{ message: error() }] : undefined}
                />
              </TextField>
              <TextField
                value={lastName()}
                onChange={setLastName}
                validationState="valid"
              >
                <TextField.Label>Фамилия (необязательно)</TextField.Label>
                <TextField.Input maxLength={NAME_MAX} />
              </TextField>
            </ActionDialogShell.Body>
            <ActionDialogShell.Footer>
              <Button
                type="button"
                variant="ghost"
                disabled={saving()}
                onClick={close}
              >
                Позже
              </Button>
              <Button type="submit" disabled={!firstName().trim() || saving()}>
                Сохранить
              </Button>
            </ActionDialogShell.Footer>
          </ActionDialogShell>
        </form>
      </Dialog>
    </Show>
  );
}
