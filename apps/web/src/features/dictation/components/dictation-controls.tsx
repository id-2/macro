import { t } from '@app/lib/i18n';
import { fireAndForget } from '@core/util/fireAndForget';
import CheckIcon from '@icon/system/regular/check.svg?component-solid';
import MicrophoneIcon from '@icon/system/regular/microphone.svg?component-solid';
import XIcon from '@icon/system/regular/x.svg?component-solid';
import { Button } from '@ui';
import { Show } from 'solid-js';
import { match } from 'ts-pattern';
import { isDictationAvailable } from '../availability';
import type { DictationController } from '../core/types';
import { VolumeTimeline } from './volume-timeline';

export function DictationButton(props: {
  dictation: DictationController;
  disabled?: boolean;
}) {
  return (
    <Show when={isDictationAvailable()}>
      <Button
        aria-label={props.dictation.label()}
        variant="ghost"
        size="icon-md"
        class="text-composer-ink"
        tooltip={props.dictation.label()}
        disabled={props.disabled || props.dictation.disabled()}
        onClick={() => fireAndForget(props.dictation.start(), 'dictation')}
      >
        <MicrophoneIcon class="size-5 touch:size-6 shrink-0 pointer-events-none" />
      </Button>
    </Show>
  );
}

export function DictationPanel(props: { dictation: DictationController }) {
  return (
    <Show when={props.dictation.active()}>
      <div
        class="absolute inset-0 z-10 flex items-center gap-2 rounded-[inherit] bg-composer px-[9.375px] text-composer-ink"
        role="group"
        aria-label={t('agentChat.dictation')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            props.dictation.cancel();
          }
        }}
      >
        <div class="flex min-w-0 flex-1 items-center gap-3 px-2">
          <VolumeTimeline levels={props.dictation.volumeHistory()} />
          <span
            class="shrink-0 text-xs text-ink-muted"
            classList={{ 'sr-only': props.dictation.phase() === 'listening' }}
            role="status"
          >
            {match(props.dictation.phase())
              .with('starting', () => t('agentChat.dictationStarting'))
              .with('finishing', () => t('agentChat.dictationFinishing'))
              .with('review', () => t('agentChat.dictationReady'))
              .otherwise(() => t('agentChat.dictationListening'))}
          </span>
        </div>
        <Button
          aria-label={t('agentChat.cancelDictation')}
          tooltip={t('agentChat.cancelDictation')}
          variant="ghost"
          size="icon-md"
          class="text-composer-ink"
          ref={(element) =>
            queueMicrotask(() => {
              if (element.isConnected) element.focus();
            })
          }
          onClick={props.dictation.cancel}
        >
          <XIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
        </Button>
        <Button
          aria-label={t('agentChat.useDictation')}
          tooltip={t('agentChat.useDictation')}
          variant="ghost"
          size="icon-md"
          class="text-composer-ink"
          disabled={
            props.dictation.phase() === 'starting' ||
            props.dictation.phase() === 'finishing'
          }
          onClick={() => fireAndForget(props.dictation.confirm(), 'dictation')}
        >
          <CheckIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
        </Button>
      </div>
    </Show>
  );
}

export function DictationFeedback(props: { dictation: DictationController }) {
  const message = () => props.dictation.message();
  return (
    <Show when={message()}>
      <p role="status" class="px-3 pt-1 text-xs text-ink-muted">
        {message()}
      </p>
    </Show>
  );
}
