import ArrowLeft from '@icon/system/regular/arrow-left.svg';
import ArrowRight from '@icon/system/regular/arrow-right.svg';
import { Show } from 'solid-js';
import { AuthButton, FormError } from './form-fields';
import { OtpInput } from './otp-input';

export function VerifyForm(props: {
  email: string;
  code: string;
  verifying: boolean;
  canVerify: boolean;
  resendIn: number;
  resending: boolean;
  error?: string;
  onCodeInput: (value: string) => void;
  onVerify: (code?: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <form
      class="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        props.onVerify();
      }}
    >
      <p class="text-xs text-ink-muted leading-snug">
        Введите 6-значный код, который мы отправили на адрес{' '}
        <span class="text-ink font-medium break-all">{props.email}</span>.
      </p>
      <OtpInput
        value={props.code}
        disabled={props.verifying}
        onInput={props.onCodeInput}
        onComplete={(code) => props.onVerify(code)}
      />
      <p class="text-center text-xs text-ink-muted" aria-live="polite">
        Не получили код?{' '}
        <button
          type="button"
          onClick={() => props.onResend()}
          disabled={props.resending || props.verifying || props.resendIn > 0}
          class="font-medium text-ink transition-colors hover:text-ink-muted disabled:text-ink-extra-muted"
        >
          <Show when={props.resendIn > 0} fallback="Отправить снова">
            Отправить снова ({props.resendIn})
          </Show>
        </button>
      </p>
      <FormError message={props.error} />
      <AuthButton type="submit" disabled={!props.canVerify}>
        Подтвердить
        <ArrowRight class="size-5 shrink-0" />
      </AuthButton>
      <AuthButton variant="secondary" onClick={props.onBack}>
        <ArrowLeft class="size-5 shrink-0" />
        Изменить адрес почты
      </AuthButton>
    </form>
  );
}
