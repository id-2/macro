import IconApple from '@icon/macro-apple.svg';
import { Show } from 'solid-js';
import { AuthButton } from './form-fields';
import { entryCopy } from './entry-copy';

export function LoginPicker(props: {
  /** Sign in with Apple is required for App Store review and iOS-only. */
  showApple: boolean;
  onApple: () => void;
  onEmail: () => void;
}) {
  return (
    <div class="flex flex-col gap-3">
      <AuthButton autofocus onClick={props.onEmail}>
        {entryCopy().continueEmail}
      </AuthButton>
      <Show when={props.showApple}>
        <AuthButton variant="secondary" onClick={props.onApple}>
          <IconApple
            viewBox="0 0 24 24"
            class="size-5 shrink-0"
            aria-hidden="true"
          />
          {entryCopy().continueApple}
        </AuthButton>
      </Show>
    </div>
  );
}
