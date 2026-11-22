import { BotAvatar } from '@channel/Bots/BotAvatar';
import { LoadingSpinner } from '@core/component/LoadingSpinner';
import CaretRightIcon from '@icon/system/regular/caret-right.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import BotIcon from '@icon/system/regular/robot.svg';
import { useBotChannelsQuery } from '@queries/bots/bots';
import type { Bot } from '@service-storage/generated/schemas/bot';
import { Button } from '@ui';
import { For, Show } from 'solid-js';
import { SettingsCard, SettingsPage, SettingsSection } from './primitives';

function BotSettingsRow(props: { bot: Bot; onOpen: (botId: string) => void }) {
  const channelsQuery = useBotChannelsQuery(() => props.bot.id);
  const channels = () => channelsQuery.data ?? [];
  const ownerLabel = () =>
    props.bot.owner?.type === 'team' ? 'Команда' : 'Личный';

  const channelSummary = () => {
    if (channelsQuery.isLoading) return 'Загрузка каналов…';
    if (channels().length === 0) return 'Пока не состоит ни в одном канале';
    if (channels().length === 1) {
      const name = channels()[0]?.name;
      return name ? `В канале ${name}` : 'В 1 канале';
    }
    const count = channels().length;
    const form = count % 10 === 1 && count % 100 !== 11 ? 'канале' : 'каналах';
    return `В ${count} ${form}`;
  };

  return (
    <button
      type="button"
      class="flex w-full items-center gap-4 px-6 py-4 text-left outline-none hover:bg-hover focus-visible:bg-hover mobile:items-start touch:px-4"
      onClick={() => props.onOpen(props.bot.id)}
    >
      <BotAvatar bot={props.bot} size="lg" />
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate text-sm font-medium text-ink">
            {props.bot.name}
          </span>
          <span class="truncate text-xs text-ink-extra-muted">
            @{props.bot.handle}
          </span>
          <span class="shrink-0 rounded-full border border-edge-muted px-2 py-0.5 font-mono text-xxs font-medium uppercase text-ink-extra-muted">
            {ownerLabel()}
          </span>
        </div>
        <div class="mt-0.5 truncate text-xs text-ink-muted">
          {props.bot.description || channelSummary()}
        </div>
        <Show when={props.bot.description}>
          <div class="mt-1 text-xs text-ink-extra-muted">
            {channelSummary()}
          </div>
        </Show>
      </div>
      <CaretRightIcon class="size-4 shrink-0 text-ink-extra-muted" />
    </button>
  );
}

export function BotSettingsList(props: {
  bots?: Bot[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (botId: string) => void;
}) {
  return (
    <SettingsPage
      title="Боты"
      description="Бот — это учётная запись, через которую программа читает и отправляет сообщения в каналах. Создайте бота, добавьте его в каналы и управляйте им токеном через Rox SDK."
      actions={
        <Button variant="primary" size="sm" onClick={props.onCreate}>
          <PlusIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
          Создать бота
        </Button>
      }
    >
      <SettingsSection
        title="Ваши боты"
        description="Управляйте ботами, их каналами и токенами доступа."
      >
        <SettingsCard>
          <Show
            when={!props.loading}
            fallback={
              <div class="flex min-h-36 items-center justify-center">
                <LoadingSpinner class="size-10 p-2" />
              </div>
            }
          >
            <Show
              when={(props.bots?.length ?? 0) > 0}
              fallback={
                <div class="flex min-h-52 flex-col items-center justify-center px-8 text-center">
                  <div class="flex size-11 items-center justify-center rounded-xl bg-accent-bg text-accent">
                    <BotIcon class="size-6" />
                  </div>
                  <div class="mt-3 text-sm font-medium text-ink">
                    Создайте первого бота
                  </div>
                  <div class="mt-1 max-w-80 text-xs text-ink-muted">
                    Дайте программе имя и профиль в Rox. Токен появится,
                    когда вы создадите бота.
                  </div>
                  <Button
                    class="mt-4"
                    variant="primary"
                    size="sm"
                    onClick={props.onCreate}
                  >
                    <PlusIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
                    Создать бота
                  </Button>
                </div>
              }
            >
              <For each={props.bots}>
                {(bot) => <BotSettingsRow bot={bot} onOpen={props.onOpen} />}
              </For>
            </Show>
          </Show>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
