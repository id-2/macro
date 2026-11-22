import { t } from '@app/lib/i18n';
import XIcon from '@icon/system/regular/x.svg';
import { Button, Dialog } from '@ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

/**
 * The opened lesson. The English videos are not played: the person sees a
 * short notice, the lesson's author, and their portrait.
 */
export function TutorialVideoDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  presenterName: string;
  presenterPhoto: string;
  /**
   * The strip under the notice. It gets the dialog's close, so a link in it
   * can leave the notice closed behind it.
   */
  footer?: (close: () => void) => JSX.Element;
}) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      position="center"
      animate
      class="w-[80vw] max-w-[80vw]"
    >
      <div class="flex h-[80vh] w-full flex-col">
        <div class="flex h-12 shrink-0 items-center gap-2 pr-2 pl-4">
          <Dialog.Title class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {props.title}
          </Dialog.Title>
          <Dialog.CloseButton
            as={Button}
            variant="ghost"
            size="icon-md"
            aria-label={t('tutorials.closeVideo')}
          >
            <XIcon class="size-4 shrink-0" />
          </Dialog.CloseButton>
        </div>
        <div class="mx-2 mb-2 flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-[18px] bg-surface px-8 text-center">
          <img
            src={props.presenterPhoto}
            alt=""
            class="size-16 shrink-0 rounded-full object-cover"
          />
          <p class="text-lg font-medium text-ink">Урок ещё не готов</p>
          <p class="max-w-md text-sm text-ink-muted">
            Короткое объяснение появится здесь на русском.
          </p>
          <p class="text-sm font-medium text-ink">{props.presenterName}</p>
        </div>
        <Show when={props.footer}>
          {(footer) => footer()(() => props.onOpenChange(false))}
        </Show>
      </div>
    </Dialog>
  );
}
