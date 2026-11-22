import { t } from '@app/lib/i18n';
import { SplitPanel } from '@components/app/split-panel';
import { toast } from '@core/component/Toast/Toast';
import { useSettingsState } from '@core/constant/SettingsState';
import { useEmail, useUserId, useUserInfo } from '@core/context/user';
import { useLogout } from '@core/auth/logout';
import { useEmailLinks } from '@core/email-link';
import { isAllowedHandle, mailboxAddress } from '@core/email/rox-mailbox';
import { invalidateUserInfo } from '@queries/auth/user-info';
import { useOwnUserName } from '@queries/auth/user-name-self';
import { authServiceClient } from '@service-auth/client';
import type { Link as EmailLink } from '@service-email/generated/schemas';
import { useNavigate } from '@solidjs/router';
import { Button } from '@ui';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
  Suspense,
} from 'solid-js';
import { LanguageSettings } from './LanguageSettings';
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './primitives';
import { writeUserNameField } from './Account';

/** A plain monospace value, so ids and addresses stay readable. */
function Value(props: { children: JSX.Element }) {
  return (
    <span class="inline-block max-w-full truncate font-mono text-sm text-ink-muted">
      {props.children}
    </span>
  );
}

function formatDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(date);
}

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** The browser's own name, from its user agent; enough to name the session. */
function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'браузер';
}

function providerLabel(link: EmailLink): string {
  switch (link.provider) {
    case 'GMAIL':
      return 'Google';
    case 'OUTLOOK':
      return 'Outlook';
    case 'ROX':
      return 'Rox';
    default:
      return link.provider;
  }
}

/**
 * One editable name part. Saving is explicit (the row has a button) so the
 * person sees the value the server accepted, and the same auth write the
 * Account settings panel uses is reused rather than repeated.
 */
function NameRow(props: {
  label: string;
  field: 'first_name' | 'last_name';
  value: string;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = createSignal(props.value);
  const [saving, setSaving] = createSignal(false);
  let lastValue = props.value;

  // Follow the server value until the person starts editing; a refetch after
  // a save lands here too.
  createEffect(() => {
    const next = props.value;
    if (next !== lastValue) {
      lastValue = next;
      setInputValue(next);
    }
  });

  const dirty = () => inputValue().trim() !== props.value;
  const canSave = () => dirty() && !saving();

  const save = async () => {
    const next = inputValue().trim();
    if (next === props.value) return;
    setSaving(true);
    const ok = await writeUserNameField(props.field, next);
    setSaving(false);
    if (!ok) {
      toast.failure('Не удалось сохранить. Попробуйте ещё раз.');
      return;
    }
    lastValue = next;
    toast.success('Сохранено');
  };

  return (
    <SettingsRow label={props.label} align="start">
      <div class="flex w-full max-w-[22rem] items-center gap-2">
        <input
          type="text"
          class="settings-input min-w-0 flex-1 rounded-sm bg-transparent px-2 py-1 text-right text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-edge-muted"
          value={inputValue()}
          placeholder={props.placeholder}
          autocomplete="off"
          spellcheck={false}
          data-1p-ignore
          onInput={(event) => setInputValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!canSave()}
          onClick={() => void save()}
        >
          {saving() ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </SettingsRow>
  );
}

function ProfileSection() {
  const email = useEmail();
  const userInfo = useUserInfo();
  const userName = useOwnUserName();

  const firstName = () => userName()?.first_name ?? '';
  const lastName = () => userName()?.last_name ?? '';
  const handle = () => userInfo()?.handle ?? undefined;
  const [handleInput, setHandleInput] = createSignal('');
  const [claiming, setClaiming] = createSignal(false);

  const claimHandle = async () => {
    const value = handleInput().trim();
    if (!isAllowedHandle(value)) {
      toast.failure(
        'Имя: 3–32 символа, строчные латинские буквы, цифры, точка, дефис или подчёркивание.'
      );
      return;
    }
    setClaiming(true);
    const result = await authServiceClient.claimHandle({ handle: value });
    setClaiming(false);
    if (result.isErr()) {
      toast.failure(
        'Имя не занято или уже выбрано для аккаунта. Попробуйте другое.'
      );
      return;
    }
    toast.success(`Адрес ${result.value.address} закреплён`);
    setHandleInput('');
    void invalidateUserInfo();
  };

  return (
    <SettingsSection
      title="Профиль"
      description="Как вас зовут в Rox и как с вами связаться."
    >
      <SettingsCard>
        <SettingsRow label="Почта">
          <Value>{email() ?? '—'}</Value>
        </SettingsRow>
        <Show when={userName()}>
          <NameRow
            label="Имя"
            field="first_name"
            value={firstName()}
            placeholder="Имя"
          />
          <NameRow
            label="Фамилия"
            field="last_name"
            value={lastName()}
            placeholder="Фамилия"
          />
        </Show>
        <Show when={handle()}>
          {(claimed) => (
            <SettingsRow
              label="Адрес в Rox"
              description="Имя закреплено за аккаунтом и не меняется."
            >
              <Value>{mailboxAddress(claimed())}</Value>
            </SettingsRow>
          )}
        </Show>
        <Show when={!handle()}>
          <SettingsRow
            label="Адрес в Rox"
            description="Выберите имя один раз: из него получится адрес вида имя@rox.one."
            align="start"
          >
            <div class="flex w-full max-w-[22rem] items-center gap-2">
              <input
                type="text"
                class="settings-input min-w-0 flex-1 rounded-sm bg-transparent px-2 py-1 text-right text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-edge-muted"
                value={handleInput()}
                placeholder="имя"
                autocomplete="off"
                spellcheck={false}
                data-1p-ignore
                onInput={(event) =>
                  setHandleInput(event.currentTarget.value.toLowerCase())
                }
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={claiming() || handleInput().length === 0}
                onClick={() => void claimHandle()}
              >
                {claiming() ? 'Закрепляем…' : 'Закрепить'}
              </Button>
            </div>
          </SettingsRow>
        </Show>
        <SettingsRow
          label="Часовой пояс"
          description="Берётся из настроек этого устройства: по нему Rox показывает время в календаре и письмах."
        >
          <Value>{deviceTimeZone()}</Value>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

function SecuritySection() {
  const email = useEmail();
  const userId = useUserId();
  const userInfo = useUserInfo();
  const logout = useLogout();

  const createdAt = createMemo(() => formatDate(userInfo()?.createdAt));

  return (
    <SettingsSection
      title="Безопасность"
      description="Где вы вошли и как завершить этот вход."
    >
      <SettingsCard>
        <SettingsRow label="Вход выполнен">
          <Value>{email() ?? '—'}</Value>
        </SettingsRow>
        <Show when={userId()}>
          {(id) => (
            <SettingsRow label="Номер аккаунта">
              <Value>{id()}</Value>
            </SettingsRow>
          )}
        </Show>
        <Show when={createdAt()}>
          {(date) => <SettingsRow label="Аккаунт создан">{date()}</SettingsRow>}
        </Show>
        <SettingsRow label="Это устройство">
          <Value>
            {browserName()} · {deviceTimeZone()}
          </Value>
        </SettingsRow>
        <SettingsRow
          label="Другие сеансы"
          description="Служба входа Rox ещё не ведёт список сеансов и не умеет завершать их по отдельности, поэтому здесь видно только текущее устройство."
        >
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            {t('settingsNav.logOut')}
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

function ConnectedSection() {
  const { openSettings } = useSettingsState();
  const { query } = useEmailLinks();
  const links = () => (query.isSuccess ? query.data.links : []);

  return (
    <SettingsSection
      title="Связанные аккаунты"
      description="Почтовые адреса, через которые Rox получает и отправляет письма от вашего имени."
    >
      <SettingsCard>
        <Show
          when={links().length > 0}
          fallback={<SettingsRow label="Пока ничего не подключено" />}
        >
          <For each={links()}>
            {(link) => (
              <SettingsRow
                label={link.email_address}
                description={
                  link.needs_reauth
                    ? 'Нужно снова разрешить доступ к этому ящику.'
                    : link.is_primary
                      ? 'Основной адрес аккаунта.'
                      : undefined
                }
              >
                <span class="text-sm text-ink-muted">
                  {providerLabel(link)}
                  {link.is_primary ? ' · основной' : ''}
                </span>
              </SettingsRow>
            )}
          </For>
        </Show>
        <SettingsRow
          label="Управление почтой"
          description="Подключение новых ящиков, подпись и синхронизация."
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openSettings('Email')}
          >
            Открыть настройки почты
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

/**
 * The onboarding flow is not a gate any more, so this is how a person opens it
 * on purpose: the slides, the handle and the plan offer.
 */
function OnboardingSection() {
  const navigate = useNavigate();
  return (
    <SettingsSection
      title="Знакомство"
      description="Короткий рассказ о Rox: зачем он нужен, как устроены данные и какой тариф выбрать."
    >
      <SettingsCard>
        <SettingsRow
          label="Пройти знакомство"
          description="Открыть первый экран Rox заново. Уже сделанные шаги останутся на месте."
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/onboarding')}
          >
            Открыть
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

function AccountPortalContent() {
  return (
    <SettingsPage
      title="Аккаунт"
      description="Личные данные, безопасность, связанные адреса и язык интерфейса."
    >
      <ProfileSection />
      <SecuritySection />
      <ConnectedSection />
      <OnboardingSection />
      {/* The local stand is pinned to Russian, so the language switch would
          store a value the interface ignores. Say that instead of lying. */}
      <section class="mt-8">
        <h2 class="text-sm font-medium text-ink">Язык</h2>
        <p class="mt-1 text-xs text-ink-muted">
          На этом локальном стенде интерфейс принудительно русский. Выбор языка
          сохраняется в аккаунте, но применится на другом стенде.
        </p>
      </section>
    </SettingsPage>
  );
}

/** The `/account` portal: one page with profile, security, links and language. */
export function AccountPortal() {
  return (
    <SplitPanel.Root>
      <SplitPanel.Body>
        <Suspense
          fallback={
            <p role="status" class="p-8 text-sm text-ink-muted">
              Загрузка аккаунта…
            </p>
          }
        >
          <AccountPortalContent />
        </Suspense>
      </SplitPanel.Body>
    </SplitPanel.Root>
  );
}
