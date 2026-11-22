import { ListSkeleton } from '@app/components/view-shell/ListSkeleton';
import GlobeIcon from '@icon/system/regular/globe.svg';
import SpinnerIcon from '@icon/system/regular/spinner.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import { Button, ToggleSwitch, Tooltip } from '@ui';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from '../../settings/primitives';
import {
  type CompanyOption,
  CompanySelect,
} from '../components/company-select';
import { useCrmContext } from '../context/crm-context';
import { isCompanyDomain } from '../core/pipeline-record';
import {
  useBlockedDomains,
  useIsTeamAdmin,
  useQuickAccessCrmCompaniesQuery,
  useTeamCrmConfig,
} from './use-crm';

function PersonalEmailsRow() {
  const isTeamAdmin = useIsTeamAdmin();
  const settings = useTeamCrmConfig();
  const excluded = () => settings.config().excludePersonalEmails ?? true;
  return (
    <SettingsRow
      label="Не добавлять личную почту"
      description={
        isTeamAdmin()
          ? 'Не добавлять людей, которые пишут с gmail.com, outlook.com и других личных служб. Если выключить, они появятся как люди без компании.'
          : 'Не добавлять людей, которые пишут с gmail.com, outlook.com и других личных служб. Изменить это могут только администраторы команды.'
      }
    >
      <Show when={settings.update.isPending}>
        <SpinnerIcon class="size-4 animate-spin text-ink-muted" />
      </Show>
      <ToggleSwitch
        size="md"
        label="Не добавлять личную почту"
        labelClass="sr-only"
        checked={excluded()}
        disabled={
          !isTeamAdmin() || settings.isLoading() || settings.update.isPending
        }
        onChange={(next) =>
          settings.update.mutate({ excludePersonalEmails: next })
        }
      />
    </SettingsRow>
  );
}

/** Add a company's current domains to the domain-level blocklist. */
function BlockCompanySelect(props: {
  onBlock(domains: string[]): Promise<void>;
  disabled: boolean;
}) {
  const suggestions = useQuickAccessCrmCompaniesQuery();
  const options = createMemo(() =>
    suggestions.companies().flatMap((company) =>
      company.domains[0]
        ? [
            {
              id: company.id,
              name: company.name,
              domain: company.domains[0].domain,
            },
          ]
        : []
    )
  );
  const domainsOf = (option: CompanyOption) =>
    suggestions
      .companies()
      .find((company) => company.id === option.id)
      ?.domains.map((entry) => entry.domain) ?? [];
  return (
    <CompanySelect
      id="block-company"
      companies={options()}
      value={undefined}
      onChange={(option) => props.onBlock(domainsOf(option))}
      loading={suggestions.query.isLoading}
      disabled={props.disabled}
    />
  );
}

function BlockedDomainsRows() {
  const { feedback } = useCrmContext();
  const isTeamAdmin = useIsTeamAdmin();
  const blocked = useBlockedDomains();
  const [draft, setDraft] = createSignal('');
  const [companyBlockPending, setCompanyBlockPending] = createSignal(false);
  const [failedDomains, setFailedDomains] = createSignal<string[]>([]);
  const domain = () => draft().trim().toLowerCase();
  const pending = () => companyBlockPending() || blocked.setBlocked.isPending;

  const blockCompanyDomains = async (values: string[]) => {
    if (pending()) return;
    // A successful block can remove the company from suggestions. Retain the
    // request snapshot and every failed domain independently of that list.
    const domains = [
      ...new Set(values.map((value) => value.trim().toLowerCase())),
    ];
    setCompanyBlockPending(true);
    try {
      const results = await Promise.allSettled(
        domains.map((domain) =>
          blocked.setBlocked.mutateAsync({ domain, blocked: true })
        )
      );
      const failed = domains.filter(
        (_, index) => results[index].status === 'rejected'
      );
      setFailedDomains((previous) => [
        ...new Set([
          ...previous.filter((value) => !domains.includes(value)),
          ...failed,
        ]),
      ]);
    } finally {
      setCompanyBlockPending(false);
    }
  };

  const setBlocked = (value: string, isBlocked: boolean) =>
    blocked.setBlocked.mutate(
      { domain: value, blocked: isBlocked },
      {
        onSuccess: () => {
          if (isBlocked && value === domain()) setDraft('');
          setFailedDomains((previous) =>
            previous.filter((domain) => domain !== value)
          );
        },
        onError: () =>
          feedback.failure(
            isBlocked
              ? `Не удалось заблокировать ${value}. Попробуйте снова.`
              : `Не удалось разблокировать ${value}. Попробуйте снова.`
          ),
      }
    );

  const addDraft = () => {
    if (!isCompanyDomain(domain()) || pending()) return;
    setBlocked(domain(), true);
  };

  return (
    <>
      <SettingsRow
        label="Заблокированные домены"
        description="Эти исключения команды останавливают почтовые вклады и скрывают совпадающие переписки CRM. Компании, люди и состояние архива не меняются."
        stackOnNarrow
      />
      <Switch>
        <Match when={blocked.isError()}>
          <div class="px-4 py-3 text-sm text-ink-muted">
            Не удалось загрузить заблокированные домены. Обновите страницу и попробуйте снова.
          </div>
        </Match>
        <Match when={blocked.isPending()}>
          <div class="px-4 py-3">
            <ListSkeleton.Bar class="h-4 w-32" />
          </div>
        </Match>
        <Match when={true}>
          <Show when={failedDomains().length > 0}>
            <div class="space-y-2 px-4 py-3">
              <p role="alert" class="break-words text-sm text-failure">
                Не удалось заблокировать {failedDomains().join(', ')}.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={pending()}
                onClick={() => blockCompanyDomains(failedDomains())}
              >
                Повторить неудачные домены
              </Button>
            </div>
          </Show>
          <For
            each={blocked.domains()}
            fallback={
              <div class="px-4 py-3 text-sm text-ink-muted">
                Нет заблокированных доменов.
              </div>
            }
          >
            {(entry) => (
              <div class="flex min-h-12 items-center gap-3 px-4 py-2">
                <GlobeIcon class="size-3.5 shrink-0 text-ink-muted" />
                <span class="min-w-0 flex-1 truncate text-sm text-ink">
                  {entry}
                </span>
                <Show when={isTeamAdmin()}>
                  <Tooltip label="Разблокировать">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Разблокировать ${entry}`}
                      disabled={pending()}
                      onClick={() => setBlocked(entry, false)}
                    >
                      <TrashIcon class="size-3.5" />
                    </Button>
                  </Tooltip>
                </Show>
              </div>
            )}
          </For>
          <Show when={isTeamAdmin()}>
            <div class="flex min-h-12 flex-wrap items-center gap-3 px-4 py-2">
              <input
                type="text"
                value={draft()}
                aria-label="Домен для блокировки"
                placeholder="Заблокировать домен, например acme.com"
                autocomplete="off"
                spellcheck={false}
                disabled={pending()}
                onInput={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addDraft();
                }}
                class="settings-input min-w-40 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                class="shrink-0"
                disabled={!isCompanyDomain(domain()) || pending()}
                onClick={addDraft}
              >
                Заблокировать
              </Button>
              <BlockCompanySelect
                onBlock={blockCompanyDomains}
                disabled={pending()}
              />
              <Show when={companyBlockPending()}>
                <span role="status" class="text-sm text-ink-muted">
                  Блокировка доменов…
                </span>
              </Show>
            </div>
          </Show>
        </Match>
      </Switch>
    </>
  );
}

/** Team controls over what email sync brings into the CRM. */
export function EmailSyncSection() {
  return (
    <SettingsSection title="Синхронизация почты">
      <SettingsCard>
        <PersonalEmailsRow />
        <BlockedDomainsRows />
      </SettingsCard>
    </SettingsSection>
  );
}
