import { toast } from '@core/component/Toast/Toast';
import { SERVER_HOSTS } from '@core/constant/servers';
import { useChannelsContext } from '@core/context/channels';
import { useEmail, useUserId } from '@core/context/user';
import {
  ROX_MAILBOX_FOLDERS,
  isAllowedHandle,
  mailboxAddress,
  mailboxNameError,
  readRoxMailboxPreferences,
  writeRoxMailboxPreferences,
  type RoxMailboxPreferences,
} from '@core/email/rox-mailbox';
import { useEmailLinks } from '@core/email-link';
import { fireAndForget } from '@core/util/fireAndForget';
import { platformFetch } from '@core/util/platformFetch';
import { Button, ToggleSwitch } from '@ui';
import { createEffect, createSignal, For, Show } from 'solid-js';
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from './primitives';

// Подписи этого экрана живут здесь: отдельный словарь почты не подключается.

const FOLDER_COPY = {
  inbox: {
    name: 'Входящие',
    detail: 'Папка по умолчанию. Входящая почта остаётся здесь.',
  },
  sent: {
    name: 'Отправленные',
    detail: 'Почта, отправленная из этого ящика.',
  },
  drafts: {
    name: 'Черновики',
    detail: 'Сообщения, которые ещё не отправлены.',
  },
  archive: {
    name: 'Архив',
    detail: 'Почта, убранная из входящих.',
  },
} as const satisfies Record<
  (typeof ROX_MAILBOX_FOLDERS)[number]['id'],
  { name: string; detail: string }
>;

const inputClass = 'settings-input w-full min-w-0';

/**
 * Claims a mailbox name through the auth handle route, then opens the ROX
 * link. Does not call the mail host or `RoxMailboxProvisioner::production`.
 */
async function claimMailboxName(handle: string): Promise<void> {
  const response = await platformFetch(
    `${SERVER_HOSTS['auth-service']}/user/handle`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    }
  );
  if (response.status === 409) {
    throw new Error('taken');
  }
  if (!response.ok) {
    throw new Error('rejected');
  }
  const body = (await response.json()) as { address?: unknown };
  if (typeof body.address !== 'string' || body.address.length === 0) {
    throw new Error('rejected');
  }
}

export function RoxMailboxSettings() {
  const email = useEmail();
  const userId = useUserId();
  const channelContext = useChannelsContext();
  const { query, initEmailLink } = useEmailLinks();
  const [name, setName] = createSignal('');
  const [claiming, setClaiming] = createSignal(false);
  const [prefs, setPrefs] = createSignal(readRoxMailboxPreferences('pending'));
  const [tagDraft, setTagDraft] = createSignal('');
  const [ruleFrom, setRuleFrom] = createSignal('');
  const [ruleTag, setRuleTag] = createSignal('');
  const [loadedFor, setLoadedFor] = createSignal('');

  const links = () => (query.isSuccess ? query.data.links : []);
  const roxLink = () =>
    links().find(
      (link) => link.provider === 'ROX' && link.macro_id === userId()
    );
  const mailboxId = () => roxLink()?.id ?? 'pending';
  const roxAddress = () => {
    const linked = roxLink()?.email_address;
    if (linked) return linked;
    const typed = name().trim();
    return isAllowedHandle(typed) ? mailboxAddress(typed) : undefined;
  };
  const nameError = () =>
    mailboxNameError(name().trim())
      ? 'Используйте от 3 до 32 строчных букв, цифр, точек, подчёркиваний или дефисов. Служебные имена, точка в начале или конце и повторяющиеся точки не допускаются.'
      : undefined;
  const channelOptions = () =>
    channelContext
      .channels()
      .filter((channel) => channel.name)
      .map((channel) => ({
        id: channel.id,
        name: channel.name ?? channel.id,
      }));

  createEffect(() => {
    const id = mailboxId();
    if (loadedFor() === id) return;
    setLoadedFor(id);
    setPrefs(readRoxMailboxPreferences(id));
  });

  const save = (next: RoxMailboxPreferences) => {
    setPrefs(next);
    writeRoxMailboxPreferences(mailboxId(), next);
  };

  const claim = async () => {
    const handle = name().trim();
    if (claiming() || !isAllowedHandle(handle) || roxLink()) return;
    setClaiming(true);
    try {
      await claimMailboxName(handle);
      const opened = await initEmailLink();
      if (opened.isErr()) {
        toast.failure(
          'Имя сохранено, но ящик Rox не удалось открыть.'
        );
        return;
      }
      toast.success('Ящик Rox теперь адрес по умолчанию.');
      setName('');
    } catch (cause) {
      toast.failure(
        cause instanceof Error && cause.message === 'taken'
          ? 'Это имя занято, или для этого аккаунта имя уже выбрано.'
          : 'Это имя не удалось занять.'
      );
    } finally {
      setClaiming(false);
    }
  };

  const addTag = () => {
    const tag = tagDraft().trim();
    if (!tag || prefs().tags.some((existing) => existing === tag)) return;
    save({ ...prefs(), tags: [...prefs().tags, tag] });
    setTagDraft('');
  };

  const addRule = () => {
    const from = ruleFrom().trim();
    const tag = ruleTag().trim();
    if (!from || !tag) return;
    save({ ...prefs(), rules: [...prefs().rules, { from, tag }] });
    setRuleFrom('');
    setRuleTag('');
  };

  return (
    <SettingsSection
      title="Ящик Rox"
      description="Адрес по умолчанию, отдельно от почты, с которой вы вошли. Google Workspace и Outlook остаются подключёнными выше."
    >
      <SettingsCard>
        <SettingsRow
          label="Вход"
          description="Адрес, которым вы вошли. Это не ящик Rox."
        >
          <span class="ph-no-capture text-sm text-ink">
            {email() || 'Нет адреса для входа'}
          </span>
        </SettingsRow>
        <SettingsRow
          label="Ящик Rox"
          description="Адрес по умолчанию. Входящая почта остаётся в этом ящике."
        >
          <span class="ph-no-capture flex items-center gap-2 text-sm text-ink">
            <span>{roxAddress() ?? 'Выберите имя'}</span>
            <Show when={roxAddress()}>
              <span class="rounded bg-edge-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                По умолчанию
              </span>
            </Show>
          </span>
        </SettingsRow>
        <Show when={!roxLink() && !query.isPending}>
          <SettingsRow
            stackOnNarrow
            align="start"
            label="Имя ящика"
            description="От 3 до 32 строчных букв, цифр, точек, подчёркиваний или дефисов. Служебные и занятые имена отклоняются."
          >
            <form
              class="flex min-w-0 flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                fireAndForget(claim(), 'email-settings');
              }}
            >
              <input
                class={inputClass}
                type="text"
                autocomplete="username"
                minLength={3}
                maxLength={32}
                pattern="[a-z0-9._-]+"
                aria-label="Имя ящика"
                value={name()}
                disabled={claiming()}
                onInput={(event) => setName(event.currentTarget.value)}
              />
              <Show when={nameError()}>
                <p role="alert" class="text-sm text-ink-muted">
                  {nameError()}
                </p>
              </Show>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={claiming() || !isAllowedHandle(name().trim())}
              >
                {claiming() ? 'Сохранение имени…' : 'Использовать этот ящик'}
              </Button>
            </form>
          </SettingsRow>
        </Show>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow label="Папки" description="Папки ящика Rox." />
        <For each={ROX_MAILBOX_FOLDERS}>
          {(folder) => (
            <SettingsRow
              label={FOLDER_COPY[folder.id].name}
              description={FOLDER_COPY[folder.id].detail}
            >
              <Show when={folder.id === 'inbox'}>
                <span class="text-xs text-ink-muted">По умолчанию</span>
              </Show>
            </SettingsRow>
          )}
        </For>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          stackOnNarrow
          label="Автоматические метки"
          description="Метки, которые ставят правила ниже. Они остаются на этом ящике."
        >
          <form
            class="flex min-w-0 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <input
              class={inputClass}
              type="text"
              aria-label="Автоматическая метка"
              value={tagDraft()}
              onInput={(event) => setTagDraft(event.currentTarget.value)}
            />
            <Button type="submit" variant="secondary" size="sm">
              Добавить метку
            </Button>
          </form>
        </SettingsRow>
        <For each={prefs().tags}>
          {(tag) => (
            <SettingsRow label={tag}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Удалить метку ${tag}`}
                onClick={() =>
                  save({
                    ...prefs(),
                    tags: prefs().tags.filter((existing) => existing !== tag),
                  })
                }
              >
                Удалить
              </Button>
            </SettingsRow>
          )}
        </For>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          stackOnNarrow
          align="start"
          label="Правила обработки"
          description="Когда приходит письмо от отправителя, ставится метка. Сообщение остаётся во входящих."
        >
          <form
            class="flex min-w-0 flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addRule();
            }}
          >
            <input
              class={inputClass}
              type="text"
              aria-label="Отправитель в правиле"
              placeholder="Отправитель"
              value={ruleFrom()}
              onInput={(event) => setRuleFrom(event.currentTarget.value)}
            />
            <input
              class={inputClass}
              type="text"
              aria-label="Метка правила"
              placeholder="Метка"
              value={ruleTag()}
              onInput={(event) => setRuleTag(event.currentTarget.value)}
            />
            <Button type="submit" variant="secondary" size="sm">
              Добавить правило
            </Button>
          </form>
        </SettingsRow>
        <For each={prefs().rules}>
          {(rule) => (
            <SettingsRow
              label={rule.from}
              description={`Ставится метка «${rule.tag}».`}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Удалить правило для ${rule.from}`}
                onClick={() =>
                  save({
                    ...prefs(),
                    rules: prefs().rules.filter((existing) => existing !== rule),
                  })
                }
              >
                Удалить
              </Button>
            </SettingsRow>
          )}
        </For>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          stackOnNarrow
          label="Пересылка"
          description="Сохраняет адрес пересылки для этого ящика. Этот экран почту не отправляет."
        >
          <ToggleSwitch
            size="md"
            label="Пересылать из ящика Rox"
            labelClass="sr-only"
            checked={prefs().forwardEnabled}
            onChange={(checked) =>
              save({ ...prefs(), forwardEnabled: checked })
            }
          />
        </SettingsRow>
        <SettingsRow label="Пересылать на">
          <input
            class={inputClass}
            type="text"
            autocomplete="off"
            aria-label="Адрес пересылки"
            value={prefs().forwardTo}
            onInput={(event) =>
              save({ ...prefs(), forwardTo: event.currentTarget.value })
            }
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          stackOnNarrow
          label="Копия в канал"
          description="Копия может уйти в канал. Само сообщение остаётся во входящих."
        >
          <ToggleSwitch
            size="md"
            label="Копировать входящую почту в канал"
            labelClass="sr-only"
            checked={prefs().copyEnabled}
            onChange={(checked) => save({ ...prefs(), copyEnabled: checked })}
          />
        </SettingsRow>
        <SettingsRow
          stackOnNarrow
          label="Канал"
          description="Куда публикуется копия. Копия во входящих не удаляется."
        >
          <select
            class={inputClass}
            aria-label="Канал для копии из входящих"
            value={prefs().channelId ?? ''}
            onChange={(event) =>
              save({
                ...prefs(),
                channelId: event.currentTarget.value || null,
              })
            }
          >
            <option value="">Выберите канал</option>
            <For each={channelOptions()}>
              {(channel) => <option value={channel.id}>{channel.name}</option>}
            </For>
          </select>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
