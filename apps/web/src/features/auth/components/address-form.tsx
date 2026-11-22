import { isAllowedHandle } from '@core/constant/mailbox-handle';
import Check from '@icon/system/bold/check-bold.svg';
import ArrowLeft from '@icon/system/regular/arrow-left.svg';
import ArrowRight from '@icon/system/regular/arrow-right.svg';
import { cn } from '@ui/utils/classname';
import { createSignal } from 'solid-js';
import { AuthButton, FormError, FormSuffixInput } from './form-fields';

/** The chosen name is checked here so the hint is in the page's language. */
const HANDLE_HINT =
  'Имя должно быть от 3 до 32 символов: строчные латинские буквы, цифры, точка, дефис или подчёркивание. Некоторые имена уже заняты.';

/** The local part the person chose, shown as their @rox.one address. */
export function AddressForm(props: {
  local: string;
  sending: boolean;
  /** The address was accepted; the button shows a check for a beat. */
  claimed?: boolean;
  error?: string;
  onLocalInput: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const [hint, setHint] = createSignal<string>();
  return (
    <form
      class="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isAllowedHandle(props.local.trim().toLowerCase())) {
          setHint(HANDLE_HINT);
          return;
        }
        setHint();
        props.onSubmit();
      }}
    >
      <h2 class="text-base font-medium text-ink">Введите имя пользователя</h2>
      <p class="text-xs text-ink-muted leading-snug">
        Вам будет присвоен почтовый адрес{' '}
        <b class="font-semibold text-ink">username</b>@rox.one, а ваш личный
        профиль будет доступен по адресу rox.one/
        <b class="font-semibold text-ink">@username</b>.
      </p>
      <FormSuffixInput
        id="rox-handle"
        placeholder="Ваше имя"
        autocomplete="off"
        value={props.local}
        suffix="@rox.one"
        ariaLabel="Имя пользователя"
        invalid={Boolean(hint() ?? props.error)}
        required={false}
        onInput={(value) => {
          setHint();
          props.onLocalInput(value);
        }}
      />
      <FormError message={hint() ?? props.error} />
      <AuthButton
        type="submit"
        disabled={props.sending}
        aria-label={
          props.claimed ? 'Адрес закреплён' : 'Использовать этот адрес'
        }
        class={cn(
          'relative isolate overflow-hidden transition-[background-color,color] duration-[420ms] ease-out motion-reduce:transition-none',
          props.claimed && 'bg-success text-accent-contrast'
        )}
      >
        {/* A single light sweep runs as the fill turns green. */}
        <span
          aria-hidden="true"
          class={cn(
            'pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgb(255_255_255/0.5)_50%,transparent_100%)] transition-transform duration-[420ms] ease-out motion-reduce:hidden',
            props.claimed ? 'translate-x-full' : '-translate-x-full'
          )}
        />
        <span class="relative flex size-5 items-center justify-center">
          <ArrowRight
            class={cn(
              'absolute size-5 transition-all duration-200 ease-out motion-reduce:transition-none',
              props.claimed && 'scale-50 opacity-0'
            )}
          />
          <Check
            class={cn(
              'absolute size-5 transition-all duration-200 ease-out motion-reduce:transition-none',
              props.claimed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            )}
          />
        </span>
      </AuthButton>
      <AuthButton variant="secondary" onClick={props.onBack} aria-label="Назад">
        <ArrowLeft class="size-5 shrink-0" />
      </AuthButton>
    </form>
  );
}
