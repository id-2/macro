import ArrowLeft from '@icon/system/regular/arrow-left.svg';
import ArrowRight from '@icon/system/regular/arrow-right.svg';
import { Show } from 'solid-js';
import { AuthButton, FormError, FormInput } from './form-fields';
import { entryCopy } from './entry-copy';

export function EmailForm(props: {
  email: string;
  password: string;
  passwordRequired: boolean;
  sending: boolean;
  error?: string;
  onEmailInput: (value: string) => void;
  onPasswordInput: (value: string) => void;
  onSubmit: () => void;
  onBack?: () => void;
}) {
  return (
    <form
      class="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <FormInput
        id="email"
        type="email"
        placeholder="вы@rox.one"
        value={props.email}
        onInput={props.onEmailInput}
      />
      <Show when={props.passwordRequired}>
        <FormInput
          id="password"
          type="password"
          placeholder={entryCopy().passwordPlaceholder}
          value={props.password}
          onInput={props.onPasswordInput}
        />
      </Show>
      <FormError message={props.error} />
      <AuthButton
        type="submit"
        disabled={props.sending}
        aria-label={entryCopy().continue}
        class="min-h-14"
      >
        <ArrowRight class="size-6 shrink-0" />
      </AuthButton>
      <Show when={props.onBack}>
        <AuthButton variant="secondary" onClick={props.onBack}>
          <ArrowLeft class="size-5 shrink-0" />
          {entryCopy().back}
        </AuthButton>
      </Show>
    </form>
  );
}
