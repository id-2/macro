import { t } from '@app/lib/i18n';
import { fireAndForget } from '@core/util/fireAndForget';
import { ThrownResultError } from '@core/util/result';
import EnvelopeIcon from '@icon/system/regular/envelope.svg';
import GlobeIcon from '@icon/system/regular/globe.svg';
import XIcon from '@icon/system/regular/x.svg';
import { Button, Dialog, EntityComposer, Panel } from '@ui';
import { createMemo, createSignal, Show } from 'solid-js';
import { isCompanyDomain } from '../core/pipeline-record';
import { useCreateCompanyMutation } from './use-crm';

export function companyCreationError(cause: unknown): string {
  if (cause instanceof ThrownResultError) {
    if (cause.errors.some((e) => e.code === 'CONFLICT')) {
      return t('crm.companyExists');
    }
    if (cause.errors.some((e) => e.code === 'FORBIDDEN')) {
      return t('crm.crmNotEnabled');
    }
  }
  return t('crm.failedCreateCompany');
}

export function CreateCompanyModal(props: {
  open: boolean;
  onClose(): void;
  onCreated(id: string): void;
}) {
  const createCompanyMutation = useCreateCompanyMutation();
  const [name, setName] = createSignal('');
  const [domain, setDomain] = createSignal('');
  const [error, setError] = createSignal<string>();
  const companyName = createMemo(() => name().trim());
  const companyDomain = createMemo(() => domain().trim().toLowerCase());
  const canSubmit = createMemo(
    () => companyName().length > 0 && !createCompanyMutation.isPending
  );

  function reset() {
    setName('');
    setDomain('');
    setError(undefined);
  }

  function resetAndClose() {
    reset();
    props.onClose();
  }

  function close() {
    if (createCompanyMutation.isPending) return;
    resetAndClose();
  }

  async function submit() {
    if (createCompanyMutation.isPending) return;
    if (!companyName()) {
      setError(t('crm.enterCompanyName'));
      return;
    }
    if (companyDomain() && !isCompanyDomain(companyDomain())) {
      setError(t('crm.enterValidDomain'));
      return;
    }

    setError(undefined);
    try {
      const { id } = await createCompanyMutation.mutateAsync({
        name: companyName(),
        domain: companyDomain() || undefined,
      });
      resetAndClose();
      props.onCreated(id);
    } catch (cause) {
      console.error('Failed to create company', cause);
      setError(companyCreationError(cause));
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && close()}>
      <Panel hideBorder class="bg-transparent rounded-[inherit] *:max-h-[75vh]">
        <Panel.Body>
          <form
            class="h-full min-h-0"
            aria-label={t('crm.newCompany')}
            onSubmit={(event) => {
              event.preventDefault();
              fireAndForget(submit(), 'crm');
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.metaKey || event.ctrlKey) &&
                !event.isComposing
              ) {
                event.preventDefault();
                event.stopPropagation();
                fireAndForget(submit(), 'crm');
              }
            }}
          >
            <EntityComposer.Root>
              <EntityComposer.Header>
                <Dialog.Title class="sr-only">{t('crm.newCompany')}</Dialog.Title>
                <EntityComposer.Title class="mb-0 min-w-0 flex-1 self-center">
                  <input
                    autofocus
                    aria-label={t('crm.companyName')}
                    placeholder={t('crm.companyName')}
                    autocomplete="off"
                    data-1p-ignore
                    aria-invalid={error() === t('crm.enterCompanyName')}
                    class="ph-no-capture w-full min-w-0 text-xl/7 font-medium outline-none bg-transparent placeholder:text-ink-placeholder"
                    value={name()}
                    disabled={createCompanyMutation.isPending}
                    onInput={(event) => {
                      setName(event.currentTarget.value);
                      setError(undefined);
                    }}
                  />
                </EntityComposer.Title>
                <Button
                  variant="ghost"
                  tabIndex={-1}
                  aria-label={t('common.close')}
                  tooltip={t('common.close')}
                  size="icon-md"
                  disabled={createCompanyMutation.isPending}
                  onClick={close}
                >
                  <XIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
                </Button>
              </EntityComposer.Header>
              <EntityComposer.Main class="gap-4">
                <label class="flex min-w-0 items-center gap-2 px-2 text-sm">
                  <GlobeIcon
                    aria-hidden="true"
                    class="size-4 shrink-0 text-ink-muted"
                  />
                  <input
                    aria-label={t('crm.domain')}
                    placeholder={t('crm.domainPlaceholder')}
                    autocomplete="off"
                    spellcheck={false}
                    data-1p-ignore
                    aria-invalid={
                      error() === t('crm.enterValidDomain')
                    }
                    class="ph-no-capture w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink-placeholder"
                    value={domain()}
                    disabled={createCompanyMutation.isPending}
                    onInput={(event) => {
                      setDomain(event.currentTarget.value);
                      setError(undefined);
                    }}
                  />
                </label>
              </EntityComposer.Main>
              <Show when={error()}>
                {(message) => (
                  <p role="alert" class="px-2 text-sm text-failure">
                    {message()}
                  </p>
                )}
              </Show>
              <EntityComposer.Footer class="items-center">
                <span class="flex min-w-0 items-center gap-1.5 px-2 text-xs text-ink-muted">
                  <EnvelopeIcon class="size-4 shrink-0" />
                  <span class="truncate">
                    {companyDomain()
                      ? t('crm.emailsLinkDomain')
                      : t('crm.addContactsByEmail')}
                  </span>
                </span>
                <EntityComposer.Submit
                  type="submit"
                  class="ml-auto"
                  hasContent={canSubmit()}
                  disabled={!canSubmit()}
                >
                  {createCompanyMutation.isPending
                    ? t('crm.creating')
                    : t('crm.createCompany')}
                </EntityComposer.Submit>
              </EntityComposer.Footer>
            </EntityComposer.Root>
          </form>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}
