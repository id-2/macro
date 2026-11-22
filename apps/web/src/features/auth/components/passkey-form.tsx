import ArrowLeft from '@icon/system/regular/arrow-left.svg';
import { Show } from 'solid-js';
import { AuthButton, FormError } from './form-fields';

/** A new account adds a passkey. A known account uses the one it already has. */
export function PasskeyForm(props: {
  mode: 'enroll' | 'assert';
  busy: boolean;
  error?: string;
  onBack: () => void;
}) {
  const enroll = () => props.mode === 'enroll';
  return (
    <form
      class="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <h2 class="text-base font-medium text-ink">
        {enroll() ? 'Добавить ключ доступа' : 'Использовать ваш ключ доступа'}
      </h2>
      <Show when={enroll()}>
        <p class="text-xs text-ink-muted leading-snug">
          Этот ключ остаётся на этом устройстве и подтверждает, что это вы.
        </p>
      </Show>
      <FormError message={props.error} />
      <AuthButton type="submit" disabled={props.busy}>
        {enroll() ? 'Добавить ключ доступа' : 'Использовать ваш ключ доступа'}
      </AuthButton>
      <AuthButton variant="secondary" onClick={props.onBack}>
        <ArrowLeft class="size-5 shrink-0" />
        Назад
      </AuthButton>
    </form>
  );
}
