import { t } from '@app/lib/i18n';
import { NotificationSoundSettingsView } from '@app/features/notification-sounds/views/NotificationSoundSettingsView';
import { useAnalytics } from '@app/lib/analytics/analytics-context';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { toast } from '@core/component/Toast/Toast';
import { enableMacroComputers } from '@core/constant/featureFlags';
import { isNativeMobilePlatform } from '@core/mobile/isNativeMobilePlatform';
import { fireAndForget } from '@core/util/fireAndForget';
import {
  EMAIL_DIGEST_NOTIFICATION_TYPE,
  NOTIFICATION_EVENT_GROUPS,
} from '@notifications/notification-event-catalog';
import { useNotificationSettings } from '@notifications/notification-settings';
import { notificationsBlockedMessage } from '@notifications/notifications-blocked-message';
import { openSnoozeNotifications } from '@notifications/SnoozeNotificationsDialog';
import { queryReadyGate } from '@queries/gate';
import {
  useNotificationTypePreferencesQuery,
  useSetNotificationTypeEnabledMutation,
} from '@queries/notification/type-preferences';
import {
  useMutedEntitiesQuery,
  useUnmuteItemMutation,
} from '@queries/notification/unsubscribes';
import { ToggleSwitch } from '@ui';
import { createSignal, For, getOwner, Show } from 'solid-js';
import { MutedItemRow } from './MutedItemRow';
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './primitives';

export function Notifications() {
  const dialogOwner = getOwner();
  const analytics = useAnalytics();
  const macroComputers = useFeatureFlag(enableMacroComputers);
  const platformSettings = useNotificationSettings();
  const [pushPending, setPushPending] = createSignal(false);
  const preferencesQuery = useNotificationTypePreferencesQuery();
  const setTypeEnabled = useSetNotificationTypeEnabledMutation();
  const mutedEntitiesQuery = useMutedEntitiesQuery({ limit: 100 });
  const unmuteItem = useUnmuteItemMutation();
  const prefsReady = () =>
    !preferencesQuery.isError && queryReadyGate(preferencesQuery);
  const mutedEntities = () =>
    !mutedEntitiesQuery.isError && queryReadyGate(mutedEntitiesQuery)
      ? mutedEntitiesQuery.data
      : [];

  const disabledTypes = () =>
    new Set(
      !preferencesQuery.isError && queryReadyGate(preferencesQuery)
        ? preferencesQuery.data.disabled_types
        : []
    );
  const snoozedEntities = () =>
    mutedEntities().filter((item) => item.snoozed_until);
  const permanentlyMutedEntities = () =>
    mutedEntities().filter(
      (item) => !item.snoozed_until && !item.mentions_only
    );
  const mentionsOnlyEntities = () =>
    mutedEntities().filter((item) => item.mentions_only);

  const isTypeEnabled = (type: string) => !disabledTypes().has(type);

  const togglePush = async (enabled: boolean) => {
    if (!platformSettings.isSupported || pushPending()) return;
    setPushPending(true);
    try {
      analytics.track('notifications_toggled');
      await platformSettings.toggle(enabled);
      if (enabled && !platformSettings.isEnabled()) {
        toast.failure(notificationsBlockedMessage());
      }
    } catch (error) {
      console.error('Could not update notification permission', error);
      toast.failure('Не удалось обновить уведомления. Повторите попытку.');
    } finally {
      setPushPending(false);
    }
  };

  const toggleType = async (type: string, enabled: boolean) => {
    try {
      await setTypeEnabled.mutateAsync({ type, enabled });
    } catch {
      toast.failure('Не удалось обновить настройку уведомлений');
    }
  };

  const unmuteEntity = async (item: { item_id: string; item_type: string }) => {
    try {
      await unmuteItem.mutateAsync(item);
    } catch {
      toast.failure('Не удалось включить уведомления для элемента');
    }
  };

  const pushLabel = isNativeMobilePlatform()
    ? 'Уведомления на телефоне'
    : 'Уведомления на компьютере';
  const pushDescription = isNativeMobilePlatform()
    ? 'Получать push-уведомления на этом устройстве'
    : 'Получать уведомления в этом браузере или приложении для компьютера';

  return (
    <SettingsPage
      title="Уведомления"
      description="Выберите, когда вас уведомлять. Элементы входящих всегда приходят, пока вы не отключите тип или элемент."
    >
      <SettingsSection title="Доставка">
        <SettingsCard>
          <SettingsRow
            label="Входящие"
            description="Всегда включены для типов, которые вы не отключили"
          >
            <span class="text-sm text-ink-muted">Всегда включено</span>
          </SettingsRow>
          <Show
            when={platformSettings.isSupported && platformSettings}
            fallback={
              <SettingsRow label={pushLabel} description={pushDescription}>
                <span class="text-sm text-ink-muted">
                  Не поддерживается на этом устройстве
                </span>
              </SettingsRow>
            }
          >
            {(settings) => (
              <SettingsRow label={pushLabel} description={pushDescription}>
                <ToggleSwitch
                  size="md"
                  label={pushLabel}
                  labelClass="sr-only"
                  checked={settings().isEnabled()}
                  disabled={pushPending()}
                  onChange={(enabled) =>
                    fireAndForget(togglePush(enabled), 'notification-settings')
                  }
                />
              </SettingsRow>
            )}
          </Show>
          <SettingsRow
            label="Сводка по почте"
            description="Периодическое письмо с непрочитанными уведомлениями. Элементы входящих не меняются."
          >
            <ToggleSwitch
              size="md"
              checked={isTypeEnabled(EMAIL_DIGEST_NOTIFICATION_TYPE)}
              disabled={!prefsReady()}
              onChange={(enabled) =>
                toggleType(EMAIL_DIGEST_NOTIFICATION_TYPE, enabled)
              }
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <NotificationSoundSettingsView />

      <For each={NOTIFICATION_EVENT_GROUPS}>
        {(group) => (
          <SettingsSection title={t(group.labelKey)}>
            <SettingsCard>
              <For
                each={group.events.filter(
                  (event) => !event.macroComputers || macroComputers().enabled
                )}
              >
                {(event) => (
                  <SettingsRow
                    label={t(event.labelKey)}
                    description={t(event.descriptionKey)}
                  >
                    <ToggleSwitch
                      size="md"
                      checked={isTypeEnabled(event.type)}
                      disabled={!prefsReady()}
                      onChange={(enabled) => toggleType(event.type, enabled)}
                    />
                  </SettingsRow>
                )}
              </For>
            </SettingsCard>
          </SettingsSection>
        )}
      </For>

      <SettingsSection
        title="Отложенные"
        description="Уведомления на паузе до выбранного времени. Элементы остаются во входящих."
      >
        <SettingsCard>
          <Show when={mutedEntitiesQuery.isError}>
            <SettingsRow label="Не удалось загрузить отложенные">
              <button
                type="button"
                onClick={() =>
                  fireAndForget(
                    mutedEntitiesQuery.refetch(),
                    'notification-settings'
                  )
                }
              >
                Повторить
              </button>
            </SettingsRow>
          </Show>
          <Show
            when={
              !mutedEntitiesQuery.isError && queryReadyGate(mutedEntitiesQuery)
            }
            fallback={
              !mutedEntitiesQuery.isError && (
                <SettingsRow label="Загрузка отложенных…" />
              )
            }
          >
            <Show
              when={snoozedEntities().length > 0}
              fallback={
                <SettingsRow
                  label="Ничего не отложено"
                  description="Щёлкните элемент правой кнопкой или откройте меню команд и выберите «Отложить уведомления»."
                />
              }
            >
              <For each={snoozedEntities()}>
                {(item) => (
                  <MutedItemRow
                    item={item}
                    onUnmute={() =>
                      fireAndForget(unmuteEntity(item), 'notification-settings')
                    }
                    onSnooze={() =>
                      openSnoozeNotifications([item], { owner: dialogOwner })
                    }
                    pending={unmuteItem.isPending}
                  />
                )}
              </For>
            </Show>
          </Show>
        </SettingsCard>
      </SettingsSection>

      <Show when={mentionsOnlyEntities().length > 0}>
        <SettingsSection
          title="Только упоминания"
          description="Эти каналы уведомляют вас, только когда вас упоминают через @."
        >
          <SettingsCard>
            <For each={mentionsOnlyEntities()}>
              {(item) => (
                <MutedItemRow
                  item={item}
                  onUnmute={() =>
                    fireAndForget(unmuteEntity(item), 'notification-settings')
                  }
                  pending={unmuteItem.isPending}
                />
              )}
            </For>
          </SettingsCard>
        </SettingsSection>
      </Show>

      <SettingsSection
        title="Отключённые"
        description="Эти элементы не будут присылать вам уведомления."
      >
        <SettingsCard>
          <Show
            when={permanentlyMutedEntities().length > 0}
            fallback={
              <SettingsRow
                label="Ничего не отключено"
                description="Отключённые элементы больше не присылают уведомления."
              />
            }
          >
            <For each={permanentlyMutedEntities()}>
              {(item) => (
                <MutedItemRow
                  item={item}
                  onUnmute={() =>
                    fireAndForget(unmuteEntity(item), 'notification-settings')
                  }
                  onSnooze={() =>
                    openSnoozeNotifications([item], { owner: dialogOwner })
                  }
                  pending={unmuteItem.isPending}
                />
              )}
            </For>
          </Show>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
