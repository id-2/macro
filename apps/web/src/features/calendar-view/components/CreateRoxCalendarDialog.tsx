import { useCreatePersonalCalendarMutation } from '@queries/calendar/calendars';
import {
  ActionDialogShell,
  Button,
  Dialog,
  type ManagedDialogProps,
  TextField,
} from '@ui';
import { createSignal } from 'solid-js';

const NAME_MAX = 120;
const DEFAULT_NAME = 'Мой календарь';

/** Names a calendar that Rox keeps, without connecting Gmail. */
export function CreateRoxCalendarDialog(props: ManagedDialogProps) {
  const [name, setName] = createSignal(DEFAULT_NAME);
  const [error, setError] = createSignal<string>();
  const createCalendar = useCreatePersonalCalendarMutation();
  const calendarName = () => name().trim();
  // The calendar is anchored where the person works; the app has no separate
  // interface zone setting, so the browser zone is it.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const nextName = calendarName();
    if (!nextName || createCalendar.isPending) return;
    setError(undefined);
    createCalendar.mutate(
      { name: nextName, timeZone },
      {
        onSuccess: () => props.onOpenChange(false),
        onError: () =>
          setError('Не удалось создать календарь. Попробуйте ещё раз.'),
      }
    );
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) =>
        !createCalendar.isPending && props.onOpenChange(open)
      }
      position="center"
      class="w-110"
    >
      <form onSubmit={submit}>
        <ActionDialogShell>
          <ActionDialogShell.Body>
            <ActionDialogShell.Header>
              <ActionDialogShell.Title>
                Создать календарь Rox
              </ActionDialogShell.Title>
              <ActionDialogShell.Description>
                Этот календарь живёт в Rox и не связан с Gmail.
              </ActionDialogShell.Description>
            </ActionDialogShell.Header>
            <TextField
              value={name()}
              onChange={(value) => {
                setName(value);
                setError(undefined);
              }}
              validationState={error() ? 'invalid' : 'valid'}
              required
            >
              <TextField.Label>Название</TextField.Label>
              <TextField.Input
                autofocus
                maxLength={NAME_MAX}
                placeholder={DEFAULT_NAME}
              />
              <TextField.ErrorMessage
                errors={error() ? [{ message: error() }] : undefined}
              />
            </TextField>
          </ActionDialogShell.Body>
          <ActionDialogShell.Footer>
            <Button
              type="button"
              variant="ghost"
              disabled={createCalendar.isPending}
              onClick={() => props.onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={
                calendarName().length === 0 ||
                [...calendarName()].length > NAME_MAX ||
                createCalendar.isPending
              }
            >
              Создать
            </Button>
          </ActionDialogShell.Footer>
        </ActionDialogShell>
      </form>
    </Dialog>
  );
}
