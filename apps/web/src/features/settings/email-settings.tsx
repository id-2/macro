import { EmailRowStylePreview } from '@app/features/email-view/components/EmailRowStylePreview';
import {
  chosenEmailRowStyle,
  setEmailRowStyle,
} from '@app/features/email-view/primitives/email-row-style';
import { toast } from '@core/component/Toast/Toast';
import { useSettingsState } from '@core/constant/SettingsState';
import { useSettingsTabAvailable } from '@core/constant/settingsTabsConfig';
import { useUserId } from '@core/context/user';
import { useEmailLinks } from '@core/email-link';
import { fireAndForget } from '@core/util/fireAndForget';
import { useUpdateEmailSettingsMutation } from '@queries/email/settings';
import type { Link as EmailLink } from '@service-email/generated/schemas';
import { Button, Tabs, ToggleSwitch } from '@ui';
import { For, Show, Suspense } from 'solid-js';
import { EmailCard } from './Email';
import { RoxMailboxSettings } from './email-rox-mailbox';
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './primitives';
import { SignatureSection } from './SignatureSection';

/**
 * `displayOptions` shows the Mail row style; the phone settings sheet leaves
 * it out because phones always show Minimalist rows.
 */
export function EmailSettings(props: { displayOptions: boolean }) {
  const { openSettings } = useSettingsState();
  const isAvailable = useSettingsTabAvailable();
  return (
    <SettingsPage
      title="Почта"
      description="Управляйте ящиками и подписью, которую отправляете с каждого аккаунта."
    >
      <SettingsSection
        title="Аккаунты"
        description="Подключайте почтовые аккаунты и управляйте их синхронизацией с Rox."
      >
        <div class="flex flex-col gap-2" aria-label="Почтовые аккаунты">
          <Suspense
            fallback={
              <p role="status" class="text-sm text-ink-muted">
                Загрузка аккаунтов…
              </p>
            }
          >
            <EmailCard />
          </Suspense>
          <RoxMailboxSettings />
        </div>
      </SettingsSection>
      <Show when={props.displayOptions}>
        <SettingsSection
          title="Параметры отображения"
          target="Display options"
          description="Выберите, как выглядит список писем."
        >
          <EmailDisplayOptions />
        </SettingsSection>
      </Show>
      <SettingsSection
        title="Подписи"
        description="Создайте подпись для каждого почтового аккаунта и просмотрите её перед отправкой."
      >
        <Suspense
          fallback={
            <p role="status" class="text-sm text-ink-muted">
              Загрузка подписей…
            </p>
          }
        >
          <EmailSignatures />
        </Suspense>
      </SettingsSection>
      <SettingsSection
        title="Уведомления о прочтении"
        description="Смотрите, когда получатели открывают отправленные вами письма."
      >
        <Suspense
          fallback={
            <p role="status" class="text-sm text-ink-muted">
              Загрузка аккаунтов…
            </p>
          }
        >
          <EmailReadReceipts />
        </Suspense>
      </SettingsSection>
      <Show when={isAvailable('Notifications') || isAvailable('Calendar')}>
        <SettingsSection title="Связанные настройки">
          <SettingsCard>
            <Show when={isAvailable('Notifications')}>
              <SettingsRow
                stackOnNarrow
                label="Почтовые уведомления"
                description="Выберите почтовые оповещения и доставку дайджеста."
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openSettings('Notifications')}
                >
                  Управлять уведомлениями
                </Button>
              </SettingsRow>
            </Show>
            <Show when={isAvailable('Calendar')}>
              <SettingsRow
                stackOnNarrow
                label="Календари"
                description="Управляйте календарями, подключёнными к почтовым аккаунтам."
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openSettings('Calendar')}
                >
                  Управлять календарями
                </Button>
              </SettingsRow>
            </Show>
          </SettingsCard>
        </SettingsSection>
      </Show>
    </SettingsPage>
  );
}

/** The Row style control and its live sample, as Display options shows them. */
export function EmailDisplayOptions() {
  return (
    <SettingsCard>
      {/* One card child, so the card draws no divider above the sample. */}
      <div>
        <SettingsRow stackOnNarrow label="Вид строки">
          <Tabs
            aria-label="Вид строки"
            touch="segmented"
            size="sm"
            options={[
              { value: 'minimalist', label: 'Минималистичный' },
              { value: 'classic', label: 'Классический' },
            ]}
            value={chosenEmailRowStyle()}
            onChange={setEmailRowStyle}
          />
        </SettingsRow>
        <EmailRowStylePreview
          rowStyle={chosenEmailRowStyle()}
          class="mx-4 mb-4"
        />
        <p class="sr-only">
          Классический вид разделяет строки линиями, выделяет непрочитанные
          более жирным текстом и всегда показывает флажок выбора.
        </p>
      </div>
    </SettingsCard>
  );
}

function EmailSignatures() {
  const userId = useUserId();
  const { query } = useEmailLinks();
  const links = () => (query.isSuccess ? query.data.links : []);
  return (
    <Show
      when={!query.isError}
      fallback={
        <SettingsCard>
          <SettingsRow label="Не удалось загрузить подписи">
            <Button
              variant="secondary"
              onClick={() => fireAndForget(query.refetch(), 'email-settings')}
            >
              Повторить
            </Button>
          </SettingsRow>
        </SettingsCard>
      }
    >
      <Show
        when={!query.isPending}
        fallback={
          <p role="status" class="text-sm text-ink-muted">
            Загрузка подписей…
          </p>
        }
      >
        <For
          each={links()}
          fallback={
            <SettingsCard>
              <SettingsRow label="Подключите почтовый аккаунт выше, чтобы добавить подпись." />
            </SettingsCard>
          }
        >
          {(link) => (
            <Suspense
              fallback={
                <p role="status" class="text-sm text-ink-muted">
                  Загрузка подписи…
                </p>
              }
            >
              <SignatureSection
                link={link}
                shared={link.macro_id !== userId()}
              />
            </Suspense>
          )}
        </For>
      </Show>
    </Show>
  );
}

function EmailReadReceipts() {
  const userId = useUserId();
  const { query } = useEmailLinks();
  const links = () =>
    (query.data?.links ?? []).filter((link) => link.macro_id === userId());
  return (
    <Show
      when={!query.isPending}
      fallback={
        <p role="status" class="text-sm text-ink-muted">
          Загрузка аккаунтов…
        </p>
      }
    >
      <Show
        when={query.data}
        fallback={
          <SettingsCard>
            <SettingsRow label="Не удалось загрузить аккаунты">
              <Button
                variant="outline"
                onClick={() => fireAndForget(query.refetch(), 'email-settings')}
              >
                Повторить
              </Button>
            </SettingsRow>
          </SettingsCard>
        }
      >
        <SettingsCard>
          <For
            each={links()}
            fallback={
              <SettingsRow label="Подключите почтовый аккаунт выше, чтобы включить уведомления о прочтении." />
            }
          >
            {(link) => <ReadReceiptsRow link={link} />}
          </For>
        </SettingsCard>
      </Show>
    </Show>
  );
}

function ReadReceiptsRow(props: { link: EmailLink }) {
  const updateSettings = useUpdateEmailSettingsMutation();
  return (
    <SettingsRow label={props.link.email_address}>
      <ToggleSwitch
        size="md"
        label={`Уведомления о прочтении для ${props.link.email_address}`}
        labelClass="sr-only"
        checked={props.link.settings.read_receipts_enabled ?? true}
        disabled={updateSettings.isPending}
        onChange={(checked) =>
          updateSettings.mutate(
            {
              linkId: props.link.id,
              settings: { read_receipts_enabled: checked },
            },
            { onError: () => toast.failure('Не удалось обновить уведомления о прочтении.') }
          )
        }
      />
    </SettingsRow>
  );
}
